use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::{Error, HttpResponse, body::EitherBody};
use std::future::{ready, Ready};
use std::net::IpAddr;
use std::pin::Pin;
use std::sync::Arc;

// ---------------------------------------------------------------------------
// Constant-time comparison (no short-circuit, length-blinded)
// ---------------------------------------------------------------------------
//
// CRIT-RL-1 (applies here too): always iterate `max(a.len, b.len)`
// so wall-clock time never betrays whether the length check fired.
// See the identical comment block in
// backend-rust/unipass-wallet-relayer/src/security.rs for the
// detailed threat model.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    let max_len = a.len().max(b.len());
    let mut diff: u8 = 0;
    for i in 0..max_len {
        let ai = if i < a.len() { a[i] } else { 0 };
        let bi = if i < b.len() { b[i] } else { 0 };
        diff |= ai ^ bi;
    }
    let bytes_eq = (diff == 0) as u8;
    let len_eq = (a.len() == b.len()) as u8;
    (bytes_eq & len_eq) == 1
}

// ===========================================================================
// API Key Authentication Middleware
// ===========================================================================
#[derive(Clone)]
pub struct ApiKeyAuth {
    api_key: Arc<String>,
}

impl ApiKeyAuth {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key: Arc::new(api_key),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for ApiKeyAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = ApiKeyAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(ApiKeyAuthMiddleware {
            service: Arc::new(service),
            api_key: self.api_key.clone(),
        }))
    }
}

pub struct ApiKeyAuthMiddleware<S> {
    service: Arc<S>,
    api_key: Arc<String>,
}

impl<S, B> Service<ServiceRequest> for ApiKeyAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let expected_key = self.api_key.clone();

        Box::pin(async move {
            // Skip auth for observability endpoints. /health and
            // /api/v1/status are legacy names kept for rollout
            // overlap; /healthz + /readyz + /metrics are the
            // canonical set exposed by huehub-observability and
            // the ones k8s probes / Prometheus scrapers expect.
            let path = req.path().to_string();
            if matches!(
                path.as_str(),
                "/health"
                    | "/api/v1/status"
                    | "/healthz"
                    | "/readyz"
                    | "/metrics"
            ) {
                let res = svc.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // Check X-API-Key header
            let provided = req
                .headers()
                .get("X-API-Key")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            if !constant_time_eq(provided.as_bytes(), expected_key.as_bytes()) {
                let resp = HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "Invalid or missing API key"}));
                return Ok(req.into_response(resp).map_into_right_body());
            }

            let res = svc.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

// ===========================================================================
// Redis-Backed Rate Limiter Middleware
// ===========================================================================
// BUG-27 FIX: Replaced in-memory HashMap-based rate limiter with Redis-backed
// implementation. In-memory state was lost on restart and not shared across
// instances, making the rate limiter ineffective in production.
#[derive(Clone)]
pub struct RateLimiter {
    /// Maximum requests per window
    max_requests: u32,
    /// Window duration in seconds
    window_secs: u64,
    /// Redis pool for persistent, cross-instance rate limit state
    redis_pool: deadpool_redis::Pool,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64, redis_pool: deadpool_redis::Pool) -> Self {
        Self {
            max_requests,
            window_secs,
            redis_pool,
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = RateLimiterMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RateLimiterMiddleware {
            service: Arc::new(service),
            max_requests: self.max_requests,
            window_secs: self.window_secs,
            redis_pool: self.redis_pool.clone(),
        }))
    }
}

pub struct RateLimiterMiddleware<S> {
    service: Arc<S>,
    max_requests: u32,
    window_secs: u64,
    redis_pool: deadpool_redis::Pool,
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let redis_pool = self.redis_pool.clone();
        let max_requests = self.max_requests;
        let window_secs = self.window_secs;

        // Extract client IP
        let ip = req
            .peer_addr()
            .map(|a| a.ip())
            .unwrap_or_else(|| IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)));

        Box::pin(async move {
            // Use Redis INCR + EXPIRE for atomic, persistent rate limiting.
            // Lua script ensures atomicity: INCR the counter and set TTL if new key.
            let redis_key = format!("farm_ratelimit:{}", ip);
            let allowed = match redis_pool.get().await {
                Ok(mut conn) => {
                    // Lua script: atomically increment and set expiry on first create
                    let lua_script = r#"
                        local current = redis.call('INCR', KEYS[1])
                        if current == 1 then
                            redis.call('EXPIRE', KEYS[1], ARGV[1])
                        end
                        return current
                    "#;
                    let result: Result<i64, _> = deadpool_redis::redis::cmd("EVAL")
                        .arg(lua_script)
                        .arg(1)  // number of keys
                        .arg(&redis_key)
                        .arg(window_secs)
                        .query_async(&mut *conn)
                        .await;
                    match result {
                        Ok(count) => count <= max_requests as i64,
                        Err(e) => {
                            // If Redis is down, fall through (fail-open) with a warning
                            tracing::warn!("Rate limiter Redis error: {}, allowing request", e);
                            true
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Rate limiter Redis pool error: {}, allowing request", e);
                    true  // fail-open if Redis is unavailable
                }
            };

            if !allowed {
                let resp = HttpResponse::TooManyRequests()
                    .json(serde_json::json!({"error": "Rate limit exceeded"}));
                return Ok(req.into_response(resp).map_into_right_body());
            }

            let res = svc.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

// ===========================================================================
// Tests
// ===========================================================================
//
// Same discipline as the relayer hardening pass: gate the pure
// `constant_time_eq` function with exhaustive tests. The Redis-backed
// RateLimiter and the ApiKeyAuth Transform are covered by the
// integration suite in the shared `huehub-security-middleware` crate;
// duplicating that harness here would add no signal.
#[cfg(test)]
mod tests {
    use super::constant_time_eq;

    #[test]
    fn equal_slices_compare_equal() {
        assert!(constant_time_eq(b"abcdef", b"abcdef"));
    }

    #[test]
    fn differing_slices_of_same_length_are_caught_at_any_position() {
        // Last-byte difference.
        assert!(!constant_time_eq(b"abcdef", b"abcdeg"));
        // First-byte difference — guards against short-circuit regressions.
        assert!(!constant_time_eq(b"abcdef", b"zbcdef"));
    }

    #[test]
    fn length_mismatch_short_circuits() {
        assert!(!constant_time_eq(b"abc", b"abcd"));
        assert!(!constant_time_eq(b"", b"a"));
    }

    #[test]
    fn both_empty_slices_compare_equal() {
        // The ApiKeyAuthMiddleware's fail-closed branch is elsewhere;
        // here we pin the mathematical identity.
        assert!(constant_time_eq(b"", b""));
    }
}
