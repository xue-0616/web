// Contract-level simulation via eth_call

use anyhow::Result;
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Bytes, TransactionRequest, U256};
use super::{SimulationResult, TransactionSimulator};

pub struct ContractSimulator {
    provider: Provider<Http>,
}

impl ContractSimulator {
    pub fn new(rpc_url: &str) -> Result<Self> {
        let provider = Provider::<Http>::try_from(rpc_url)?;
        Ok(Self { provider })
    }
}

#[async_trait::async_trait]
impl TransactionSimulator for ContractSimulator {
    async fn simulate(
        &self,
        wallet: Address,
        calldata: Bytes,
        _chain_id: u64,
    ) -> Result<SimulationResult> {
        let tx = TransactionRequest::new()
            .to(wallet)
            .data(calldata);
        let typed_tx = tx.into();

        // 1) eth_call — detect reverts / surface return data.
        let call_result: std::result::Result<Bytes, _> =
            self.provider.call(&typed_tx, None).await;
        let return_data = match call_result {
            Ok(d) => d,
            Err(e) => {
                return Ok(SimulationResult {
                    success: false,
                    gas_used: U256::zero(),
                    return_data: Bytes::new(),
                    error: Some(format!("eth_call reverted: {}", e)),
                });
            }
        };

        // 2) eth_estimateGas — real gas measurement (adds a small safety margin).
        let gas_used = match self.provider.estimate_gas(&typed_tx, None).await {
            Ok(g) => {
                // 15% buffer to survive block-to-block variance.
                g.saturating_mul(U256::from(115)) / U256::from(100)
            }
            Err(e) => {
                tracing::warn!(
                    ?e,
                    "eth_estimateGas failed after successful eth_call; falling back to conservative default"
                );
                // Conservative fallback — larger than the old hard-coded 200k to cover
                // complex UniPass meta-tx execution paths.
                U256::from(500_000)
            }
        };

        Ok(SimulationResult {
            success: true,
            gas_used,
            return_data,
            error: None,
        })
    }
}
