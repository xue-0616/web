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
        // MED-SW-2: deployment surface exposed via /configurations
        pub sequencer_lock_code_hash: String,
        pub sequencer_lock_hash_type: u8,
        pub sequencer_lock_args: String,
        pub pool_type_code_hash: String,
        pub configs_cell_type_hash: String,
        pub deployment_cell_type_hash: String,
        pub swap_fee_bps: u16,
        pub min_liquidity: String,
        pub max_intents_per_batch: u32,
        pub batch_interval_ms: u32,
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
