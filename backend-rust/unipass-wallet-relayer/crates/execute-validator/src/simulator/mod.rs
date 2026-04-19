pub mod anvil_simulator;
pub mod contract_simulator;

use anyhow::Result;
use ethers::types::{Address, Bytes, U256};

#[derive(Debug, Clone)]
pub struct SimulationResult {
    pub success: bool,
    pub gas_used: U256,
    pub return_data: Bytes,
    pub error: Option<String>,
}

#[async_trait::async_trait]
pub trait TransactionSimulator: Send + Sync {
    async fn simulate(
        &self,
        wallet: Address,
        calldata: Bytes,
        chain_id: u64,
    ) -> Result<SimulationResult>;
}
