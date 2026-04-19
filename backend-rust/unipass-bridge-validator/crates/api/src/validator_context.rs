use sea_orm::DatabaseConnection;
use std::sync::Arc;

#[derive(Clone)]
pub struct ValidatorContext {
    db: DatabaseConnection,
    redis: deadpool_redis::Pool,
    pub config: configs::ValidatorConfig,
    pub signer: Arc<validator_signer::ValidatorSigner>,
}

impl ValidatorContext {
    pub fn new(
        db: DatabaseConnection,
        redis: deadpool_redis::Pool,
        config: configs::ValidatorConfig,
    ) -> anyhow::Result<Self> {
        let signer = validator_signer::ValidatorSigner::new(&config.validator_private_key)?;
        tracing::info!("Validator context initialized, validator address: {:?}", signer.address());
        Ok(Self {
            db,
            redis,
            config,
            signer: Arc::new(signer),
        })
    }

    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub async fn redis_conn(&self) -> anyhow::Result<deadpool_redis::Connection> {
        Ok(self.redis.get().await?)
    }

    pub fn redis_pool(&self) -> &deadpool_redis::Pool {
        &self.redis
    }
}
