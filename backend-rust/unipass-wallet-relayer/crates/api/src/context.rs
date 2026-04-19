use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct RelayerContext {
    db: DatabaseConnection,
    redis: deadpool_redis::Pool,
    pub config: configs::RelayerConfig,
}

impl RelayerContext {
    pub fn new(db: DatabaseConnection, redis: deadpool_redis::Pool, config: configs::RelayerConfig) -> Self {
        Self { db, redis, config }
    }
    pub fn db(&self) -> &DatabaseConnection { &self.db }
    pub async fn redis_conn(&self) -> anyhow::Result<deadpool_redis::Connection> {
        Ok(self.redis.get().await?)
    }
}
