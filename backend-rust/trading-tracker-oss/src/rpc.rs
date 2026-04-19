//! JSON-RPC server (jsonrpsee). Matches the closed-source binary's
//! `rpc::TradingTrackerRpcServer` + `rpc::TradingTrackerServer` exports:
//!
//!   * `add_pool(PoolSpec) -> ()`
//!   * `subscribe_token_price(mint: Pubkey)` — WebSocket subscription.

use std::sync::Arc;

use jsonrpsee::{
    core::{async_trait, SubscriptionResult},
    proc_macros::rpc,
    server::{ServerHandle, SubscriptionMessage},
    types::error::ErrorObjectOwned,
    PendingSubscriptionSink,
};
use solana_pubkey::Pubkey;

use crate::{
    config::{PoolConfig, RpcBindCfg},
    error::DexautoTrackerError,
    token_price_manager::runner::TokenPriceRunner,
};

#[rpc(server, namespace = "trading_tracker")]
pub trait TradingTrackerRpc {
    /// Start tracking a new pool.
    #[method(name = "add_pool")]
    async fn add_pool(&self, cfg: PoolConfig) -> Result<(), ErrorObjectOwned>;

    /// Subscribe to price updates for any pool whose `mint_a` OR `mint_b`
    /// equals the requested mint. Yields `PoolPrice` JSON objects.
    #[subscription(name = "subscribe_token_price" => "token_price", item = crate::dex_pool::PoolPrice)]
    async fn subscribe_token_price(&self, mint: String) -> SubscriptionResult;
}

pub struct TradingTrackerServer {
    runner: Arc<TokenPriceRunner>,
}

impl TradingTrackerServer {
    pub fn new(runner: Arc<TokenPriceRunner>) -> Self {
        Self { runner }
    }
}

#[async_trait]
impl TradingTrackerRpcServer for TradingTrackerServer {
    async fn add_pool(&self, cfg: PoolConfig) -> Result<(), ErrorObjectOwned> {
        self.runner.add_pool(cfg).map_err(Into::into)
    }

    async fn subscribe_token_price(
        &self,
        pending: PendingSubscriptionSink,
        mint: String,
    ) -> SubscriptionResult {
        let mint: Pubkey = mint.parse().map_err(|_| {
            ErrorObjectOwned::from(DexautoTrackerError::Deserialize(format!(
                "invalid mint pubkey: {mint}"
            )))
        })?;
        let mut rx = self.runner.subscribe();
        let sink = pending.accept().await?;
        tokio::spawn(async move {
            while let Ok(price) = rx.recv().await {
                if price.base_mint != mint && price.quote_mint != mint {
                    continue;
                }
                let msg = match SubscriptionMessage::from_json(&price) {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::warn!(error = ?e, "serialize PoolPrice failed");
                        break;
                    }
                };
                if sink.send(msg).await.is_err() {
                    break; // subscriber dropped
                }
            }
        });
        Ok(())
    }
}

/// Start the jsonrpsee server and register the `TradingTrackerServer` module.
pub async fn serve(
    cfg: &RpcBindCfg,
    runner: Arc<TokenPriceRunner>,
) -> Result<ServerHandle, DexautoTrackerError> {
    let server = jsonrpsee::server::ServerBuilder::default()
        .max_connections(cfg.max_connections)
        .build(cfg.listen_addr)
        .await
        .map_err(|e| DexautoTrackerError::Unknown(format!("rpc server bind: {e}")))?;
    let module = TradingTrackerServer::new(runner).into_rpc();
    let handle = server.start(module);
    Ok(handle)
}
