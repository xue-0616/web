use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct PaymentContext {
    db: DatabaseConnection,
    redis: deadpool_redis::Pool,
    pub config: config::PaymentConfig,
}

impl PaymentContext {
    pub fn new(db: DatabaseConnection, redis: deadpool_redis::Pool, config: config::PaymentConfig) -> Self {
        Self { db, redis, config }
    }
    pub fn db(&self) -> &DatabaseConnection { &self.db }
    pub async fn redis_conn(&self) -> anyhow::Result<deadpool_redis::Connection> {
        Ok(self.redis.get().await?)
    }
}
