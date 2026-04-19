//! jsonrpsee RPC surface.
//!
//! Two methods (matches the RPC method names recovered from the
//! closed-source ELF's `paymasterverifying_paymas...` string which is
//! a truncated view of the method namespace `pm`):
//!
//!   * `pm_sponsorUserOperation(UserOp, EntryPoint, ChainId) -> SponsorResponse`
//!   * `pm_supportedEntryPoints() -> [address]`

use std::sync::Arc;

use ethers_core::types::Address;
use jsonrpsee::{
    core::RpcResult,
    proc_macros::rpc,
    types::{ErrorObject, ErrorObjectOwned},
};

use crate::{
    paymaster::{Paymaster, PaymasterError, SponsorResponse},
    user_operation::UserOperation,
};

#[rpc(server, namespace = "pm")]
pub trait PaymasterRpc {
    /// Produce a signed `paymasterAndData` blob for the given user op.
    #[method(name = "sponsorUserOperation")]
    async fn sponsor_user_operation(
        &self,
        op: UserOperation,
        entry_point: Address,
        chain_id: u64,
    ) -> RpcResult<SponsorResponse>;

    /// List entry-point addresses this paymaster supports (one per configured chain).
    #[method(name = "supportedEntryPoints")]
    async fn supported_entry_points(&self) -> RpcResult<Vec<Address>>;
}

pub struct PaymasterRpcImpl {
    pub paymaster: Arc<Paymaster>,
}

#[jsonrpsee::core::async_trait]
impl PaymasterRpcServer for PaymasterRpcImpl {
    async fn sponsor_user_operation(
        &self,
        op: UserOperation,
        entry_point: Address,
        chain_id: u64,
    ) -> RpcResult<SponsorResponse> {
        // Verify the client-supplied entry_point matches the one we have
        // configured for this chain — a common client mistake is to send
        // a v0.7 entry-point address to a v0.6 paymaster, yielding a
        // silently-invalid signature at exec time.
        match self.paymaster.entry_point_for(chain_id) {
            Some(configured) if configured == entry_point => {}
            Some(_configured) => {
                return Err(ErrorObject::owned(
                    -32602,
                    "entry_point mismatch for chain_id",
                    None::<()>,
                ));
            }
            None => {
                return Err(pm_error(PaymasterError::UnsupportedChain(chain_id)));
            }
        }
        self.paymaster
            .sponsor(&op, chain_id)
            .await
            .map_err(pm_error)
    }

    async fn supported_entry_points(&self) -> RpcResult<Vec<Address>> {
        let mut out = Vec::new();
        for cid in self.paymaster.supported_chain_ids() {
            if let Some(ep) = self.paymaster.entry_point_for(cid) {
                out.push(ep);
            }
        }
        // Deduplicate — same entry-point across chains is common.
        out.sort_unstable();
        out.dedup();
        Ok(out)
    }
}

fn pm_error(e: PaymasterError) -> ErrorObjectOwned {
    let code = match &e {
        PaymasterError::UnsupportedChain(_) => -32001,
        PaymasterError::SenderNotAllowed(_) => -32002,
        PaymasterError::InvalidSignerKey(_) => -32003,
        PaymasterError::Sign(_) => -32004,
    };
    ErrorObject::owned(code, e.to_string(), None::<()>)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{ChainConfig, Config};
    use ethers_core::types::U256;
    use std::collections::HashMap;

    fn mk_paymaster() -> Arc<Paymaster> {
        let mut chains = HashMap::new();
        chains.insert(
            1,
            ChainConfig {
                paymaster_address: Address::repeat_byte(0x01),
                entry_point: Address::repeat_byte(0xEE),
                rpc_url: None,
            },
        );
        chains.insert(
            137,
            ChainConfig {
                paymaster_address: Address::repeat_byte(0x02),
                entry_point: Address::repeat_byte(0xEE),
                rpc_url: None,
            },
        );
        Arc::new(
            Paymaster::new(Arc::new(Config {
                bind: "0.0.0.0:0".into(),
                signer_private_key:
                    "0x1111111111111111111111111111111111111111111111111111111111111111".into(),
                chains,
                whitelist: vec![],
                validity_window_secs: 600,
            }))
            .unwrap(),
        )
    }

    fn sample_op() -> UserOperation {
        UserOperation {
            sender: Address::repeat_byte(0xab),
            nonce: U256::from(1),
            init_code: Default::default(),
            call_data: Default::default(),
            call_gas_limit: U256::from(100_000),
            verification_gas_limit: U256::from(100_000),
            pre_verification_gas: U256::from(21_000),
            max_fee_per_gas: U256::from(1),
            max_priority_fee_per_gas: U256::from(1),
            paymaster_and_data: Default::default(),
            signature: Default::default(),
        }
    }

    #[tokio::test]
    async fn sponsor_ok_on_matching_entry_point() {
        let rpc = PaymasterRpcImpl { paymaster: mk_paymaster() };
        let ep = Address::repeat_byte(0xEE);
        let out = rpc.sponsor_user_operation(sample_op(), ep, 1).await.unwrap();
        assert_eq!(out.paymaster_and_data.len(), 20 + 64 + 65);
    }

    #[tokio::test]
    async fn sponsor_rejects_mismatched_entry_point() {
        let rpc = PaymasterRpcImpl { paymaster: mk_paymaster() };
        let wrong_ep = Address::repeat_byte(0xAA);
        let err = rpc.sponsor_user_operation(sample_op(), wrong_ep, 1).await.unwrap_err();
        assert_eq!(err.code(), -32602);
    }

    #[tokio::test]
    async fn sponsor_rejects_unknown_chain() {
        let rpc = PaymasterRpcImpl { paymaster: mk_paymaster() };
        let ep = Address::repeat_byte(0xEE);
        let err = rpc.sponsor_user_operation(sample_op(), ep, 999).await.unwrap_err();
        assert_eq!(err.code(), -32001);
    }

    #[tokio::test]
    async fn supported_entry_points_dedups() {
        let rpc = PaymasterRpcImpl { paymaster: mk_paymaster() };
        let out = rpc.supported_entry_points().await.unwrap();
        // Both chains use the same entry-point address, so after dedup we
        // should have exactly one entry.
        assert_eq!(out.len(), 1);
        assert_eq!(out[0], Address::repeat_byte(0xEE));
    }
}
