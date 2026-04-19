use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct AppContext {
    db: DatabaseConnection,
    redis: deadpool_redis::Pool,
    pub config: EnvConfigRef,
}

impl AppContext {
    pub fn new(db: DatabaseConnection, redis: deadpool_redis::Pool, config: impl Into<EnvConfigRef>) -> Self {
        Self { db, redis, config: config.into() }
    }
    pub fn db(&self) -> &DatabaseConnection { &self.db }
    pub async fn redis_conn(&self) -> anyhow::Result<deadpool_redis::Connection> {
        Ok(self.redis.get().await?)
    }
    pub fn redis_pool(&self) -> &deadpool_redis::Pool { &self.redis }
}

/// Lightweight config ref shared across handlers
#[derive(Clone, Debug)]
pub struct EnvConfigRef {
    pub ckb_rpc_url: String,
    pub ckb_indexer_url: String,
    pub sequencer_api_url: String,
    pub slack_webhook: String,
    /// Allow-list of CKB addresses permitted to submit privileged intents
    /// (e.g. pool creation). Populated from `FARM_ADMIN_ADDRESSES`
    /// (comma-separated).
    pub admin_addresses: Vec<String>,
    /// Hex-encoded compressed (33-byte) or uncompressed (65-byte) secp256k1
    /// public keys paired with `admin_addresses`. Populated from
    /// `FARM_ADMIN_PUBKEYS` (comma-separated). Used for signature verification.
    pub admin_pubkeys: Vec<String>,
}

impl EnvConfigRef {
    pub fn new(
        ckb_rpc_url: String,
        ckb_indexer_url: String,
        sequencer_api_url: String,
        slack_webhook: String,
        admin_addresses: Vec<String>,
        admin_pubkeys: Vec<String>,
    ) -> Self {
        Self {
            ckb_rpc_url,
            ckb_indexer_url,
            sequencer_api_url,
            slack_webhook,
            admin_addresses,
            admin_pubkeys,
        }
    }

    /// Returns `true` iff `addr` exactly matches one of the configured admins.
    pub fn is_admin(&self, addr: &str) -> bool {
        self.admin_addresses.iter().any(|a| a == addr)
    }
}
