// Anvil local fork simulator — fork mainnet state and simulate tx locally.
//
// **Stub.** This is the ~ "run the tx against an Anvil fork"
// implementation of `TransactionSimulator`; the production path uses
// `RpcSimulator` (eth_call against an upstream RPC) instead. The
// Anvil variant is kept as a TODO-in-waiting: operators who want to
// test against a mainnet fork locally will need a real impl of
// `simulate()` that spawns an anvil process, replays state, and
// returns the real revert reason.
//
// Every argument here is the input the real impl will consume:
//   * `_wallet`    — the UniPass wallet address to simulate against
//   * `_calldata`  — the execute() calldata the validator built
//   * `_chain_id`  — which chain's fork to target
// Underscore-prefixed only to silence -Wunused-variables without
// changing the public trait method signature.

use anyhow::Result;
use ethers::types::{Address, Bytes, U256};
use super::{SimulationResult, TransactionSimulator};

/// Anvil-based local fork simulation — spins up an Anvil instance forking the target chain.
pub struct AnvilSimulator {
    /// RPC endpoint anvil will fork from. Read in the real impl;
    /// kept here (and `#[allow(dead_code)]`'d) so `new()` stays
    /// source-compatible when the body is fleshed out.
    #[allow(dead_code)]
    fork_url: String,
}

impl AnvilSimulator {
    pub fn new(fork_url: &str) -> Self {
        Self { fork_url: fork_url.to_string() }
    }
}

#[async_trait::async_trait]
impl TransactionSimulator for AnvilSimulator {
    async fn simulate(
        &self,
        _wallet: Address,
        _calldata: Bytes,
        _chain_id: u64,
    ) -> Result<SimulationResult> {
        // Fork simulation using Anvil (local EVM fork):
        //   1. Spawn Anvil with --fork-url = self.fork_url
        //   2. Send eth_call or eth_sendTransaction for (_wallet, _calldata)
        //   3. Capture revert reason if failed
        //   4. Return gas estimate
        // The happy-path placeholder below is only reached in unit
        // tests that wire the type explicitly; the production code
        // path is `RpcSimulator`.
        tracing::info!("Running Anvil fork simulation (stub)");
        Ok(SimulationResult {
            success: true,
            gas_used: U256::from(200_000),
            return_data: Bytes::new(),
            error: None,
        })
    }
}
