use deadpool_redis::Pool as RedisPool;
use sea_orm::DatabaseConnection;

/// Shared application context — injected into all handlers via actix-web Data
#[derive(Clone)]
pub struct AppContext {
    pub db: DatabaseConnection,
    pub redis: RedisPool,
    pub config: crate::config_ref::EnvConfigRef,
}

/// Lightweight reference to env config (avoids circular dependency)
pub mod config_ref {
    #[derive(Debug, Clone)]
    pub struct EnvConfigRef {
        pub ckb_rpc_url: String,
        pub ckb_indexer_url: String,
        pub jwt_secret: String,
        pub sequencer_utxo_global_api_key: String,
        pub slack_webhook: String,
        pub github_token: String,
    }
}

// Re-export for convenience
pub use config_ref::EnvConfigRef;

impl AppContext {
    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub async fn redis_conn(
        &self,
    ) -> Result<deadpool_redis::Connection, deadpool_redis::PoolError> {
        self.redis.get().await
    }
}
