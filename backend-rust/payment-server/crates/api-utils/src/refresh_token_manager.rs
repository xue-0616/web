use anyhow::Result;
use chrono::{Duration, Utc};

/// Manages JWT refresh tokens with JTI-based revocation support.
/// Uses a separate secret from access tokens and stores JTI in Redis for revocation.
pub struct RefreshTokenManager {
    /// Separate secret for refresh tokens (distinct from access token secret)
    secret: String,
    expiry_days: i64,
}

/// Redis key prefix for refresh token JTIs
const REFRESH_JTI_PREFIX: &str = "refresh_jti:";

impl RefreshTokenManager {
    /// Create a new RefreshTokenManager with a **separate** secret from access tokens.
    pub fn new(secret: &str, expiry_days: i64) -> Self {
        Self { secret: secret.to_string(), expiry_days }
    }

    /// Issue a new refresh token with a unique JTI claim.
    /// The JTI is stored in Redis with a TTL matching the token expiry.
    pub async fn issue(&self, user_id: &str, redis: &mut deadpool_redis::Connection) -> Result<String> {
        let jti = uuid::Uuid::new_v4().to_string();
        let exp = (Utc::now() + Duration::days(self.expiry_days)).timestamp() as usize;
        let ttl_secs = self.expiry_days * 86400;

        let claims = serde_json::json!({
            "sub": user_id,
            "exp": exp,
            "type": "refresh",
            "jti": jti,
        });

        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(self.secret.as_bytes()),
        )?;

        // Store JTI in Redis with TTL
        let redis_key = format!("{}{}", REFRESH_JTI_PREFIX, jti);
        redis::cmd("SET")
            .arg(&redis_key)
            .arg(user_id)
            .arg("EX")
            .arg(ttl_secs)
            .query_async::<()>(redis)
            .await?;

        Ok(token)
    }

    /// Validate a refresh token: verify JWT signature AND check JTI exists in Redis.
    /// Returns the user_id if valid.
    pub async fn validate(&self, token: &str, redis: &mut deadpool_redis::Connection) -> Result<String> {
        let data = jsonwebtoken::decode::<serde_json::Value>(
            token,
            &jsonwebtoken::DecodingKey::from_secret(self.secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        )?;

        let sub = data.claims["sub"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'sub' claim in refresh token"))?
            .to_string();

        let jti = data.claims["jti"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'jti' claim in refresh token"))?;

        // Verify JTI exists in Redis (not revoked)
        let redis_key = format!("{}{}", REFRESH_JTI_PREFIX, jti);
        let exists: bool = redis::cmd("EXISTS")
            .arg(&redis_key)
            .query_async(redis)
            .await?;

        if !exists {
            anyhow::bail!("Refresh token has been revoked or expired");
        }

        Ok(sub)
    }

    /// Rotate a refresh token atomically: validate JWT, then use a Lua script to
    /// delete old JTI and create new JTI in a single Redis operation.
    /// This prevents race conditions where two concurrent rotations could both succeed.
    pub async fn rotate(&self, old_token: &str, redis: &mut deadpool_redis::Connection) -> Result<String> {
        // Step 1: Verify JWT signature and extract claims (no Redis call yet)
        let old_data = jsonwebtoken::decode::<serde_json::Value>(
            old_token,
            &jsonwebtoken::DecodingKey::from_secret(self.secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        )?;

        let user_id = old_data.claims["sub"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'sub' claim in refresh token"))?
            .to_string();

        let old_jti = old_data.claims["jti"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'jti' claim in refresh token"))?;

        // Step 2: Prepare new token values
        let new_jti = uuid::Uuid::new_v4().to_string();
        let new_ttl = self.expiry_days * 86400;

        let old_key = format!("{}{}", REFRESH_JTI_PREFIX, old_jti);
        let new_key = format!("{}{}", REFRESH_JTI_PREFIX, new_jti);

        // Step 3: Atomic Lua script — delete old JTI only if it exists, then create new JTI.
        // Returns 1 on success, 0 if old JTI was already consumed (replay/race).
        let lua_script = r#"
            local old_jti = ARGV[1]
            local new_jti = ARGV[2]
            local new_ttl = tonumber(ARGV[3])
            if redis.call("exists", KEYS[1]) == 1 then
                redis.call("del", KEYS[1])
                redis.call("setex", KEYS[2], new_ttl, "1")
                return 1
            else
                return 0
            end
        "#;

        let result: i64 = redis::cmd("EVAL")
            .arg(lua_script)
            .arg(2i64) // number of KEYS
            .arg(&old_key)
            .arg(&new_key)
            .arg(old_jti)
            .arg(&new_jti)
            .arg(new_ttl)
            .query_async(redis)
            .await?;

        if result == 0 {
            anyhow::bail!("Refresh token has been revoked or already rotated");
        }

        // Step 4: Issue new JWT with the new JTI
        let exp = (chrono::Utc::now() + Duration::days(self.expiry_days)).timestamp() as usize;
        let claims = serde_json::json!({
            "sub": user_id,
            "exp": exp,
            "type": "refresh",
            "jti": new_jti,
        });

        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(self.secret.as_bytes()),
        )?;

        Ok(token)
    }

    /// Revoke a refresh token by deleting its JTI from Redis.
    pub async fn revoke(&self, token: &str, redis: &mut deadpool_redis::Connection) -> Result<()> {
        let data = jsonwebtoken::decode::<serde_json::Value>(
            token,
            &jsonwebtoken::DecodingKey::from_secret(self.secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        )?;

        if let Some(jti) = data.claims["jti"].as_str() {
            let redis_key = format!("{}{}", REFRESH_JTI_PREFIX, jti);
            redis::cmd("DEL").arg(&redis_key).query_async::<()>(redis).await?;
        }

        Ok(())
    }
}
