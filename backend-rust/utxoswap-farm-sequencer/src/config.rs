use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct EnvConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub ckb_rpc_url: String,
    pub ckb_indexer_url: String,
    #[serde(default)]
    pub sequencer_api_url: String,  // UTXOSwap sequencer API for swap_client
    #[serde(default)]
    pub slack_webhook: String,
}

fn default_port() -> u16 { 8081 }

impl EnvConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(envy::from_env::<Self>()?)
    }
}
