pub mod apollo_client;
pub mod config;
pub use config::PaymentConfig;

pub async fn load() -> anyhow::Result<PaymentConfig> {
    config::PaymentConfig::from_env()
}
