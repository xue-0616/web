//! `POST /api/v1/transactions` — accept a UniPass ModuleMain meta-tx
//! for relay.
//!
//! **BUG-P2-C2** fix lives here. The previous implementation was
//! unsafe: it hashed the raw outer calldata, ran ECDSA recover, and
//! accepted the tx iff the recovered address matched whatever
//! `wallet_address` the client sent in the body. That field is
//! attacker-controlled, so the check was tautological — anyone with a
//! single (calldata, signature) pair could relay any calldata they
//! liked simply by setting `wallet_address = recover(keccak256(cd),sig)`.
//!
//! The new pipeline (all mandatory):
//!
//!   1. **Parse** `ModuleMain.execute(bytes _txs, uint256 _nonce,
//!      bytes _signature)` out of the calldata.
//!   2. **Structural validation** ([`execute_validator::validator`]):
//!      reject > 32 inner txs, reject any `delegate_call=true`,
//!      reject oversized gas_limit, reject value overflow.
//!   3. **Replay protection**: atomically claim `(chainId, wallet,
//!      nonce)` in Redis via [`crate::replay::RedisReplayCache`].
//!      First-write-wins; a second submission of the same tuple is
//!      rejected.
//!   4. **On-chain signature verification**: `eth_call` the full
//!      execute against the wallet via [`ContractSimulator`]. The
//!      wallet's own `_validateSignature` is the ground truth — if
//!      eth_call reverts, the signature (or calldata) is invalid.
//!      **If** we skipped this and relied on our own ecrecover we
//!      would either (a) reject legitimate multisig / EIP-1271
//!      signatures, or (b) mis-hash the structured data.
//!   5. **Queue** the tx for broadcast (unchanged).
//!
//! The handler is intentionally thin: the real logic lives in
//! [`validate_meta_tx`], which takes trait objects for simulator and
//! replay cache so it's unit-testable without RPC or Redis.

use actix_web::{web, HttpResponse};
use api::context::RelayerContext;
use ethers::types::{Address, Bytes};
use execute_validator::execute_parser::parse_execute_calldata;
use execute_validator::simulator::{
    contract_simulator::ContractSimulator, TransactionSimulator,
};
use execute_validator::validator::{validate_structural, ValidationError};
use serde::Deserialize;
use std::str::FromStr;

use crate::api::rpc_client::rpc_url_for_chain;
use crate::replay::{RedisReplayCache, ReplayCache, ReplayError};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendTxRequest {
    pub chain_id: u64,
    pub wallet_address: String,
    pub calldata: String,
    /// Accepted but ignored. The signature that actually matters is
    /// embedded inside the execute calldata's `_signature` field and
    /// verified against the wallet contract via `eth_call`. Kept on
    /// the DTO only so older clients' requests still deserialize.
    #[serde(default)]
    pub signature: Option<String>,
    pub fee_token: Option<String>,
    pub fee_amount: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum RelayRejection {
    #[error("invalid hex in calldata")]
    InvalidHex,
    #[error("invalid wallet address")]
    InvalidWallet,
    #[error("calldata does not parse as ModuleMain.execute: {0}")]
    ParseFailure(String),
    #[error("structural validation failed: {0}")]
    Structural(#[from] ValidationError),
    #[error("replay detected: (chainId={chain_id}, wallet={wallet:?}, nonce={nonce})")]
    Replay { chain_id: u64, wallet: Address, nonce: String },
    #[error("replay cache unavailable: {0}")]
    ReplayBackend(String),
    #[error("on-chain simulation reverted: {0}")]
    SimulationReverted(String),
    #[error("no RPC configured for chainId {0}")]
    RpcUnconfigured(u64),
    #[error("simulator error: {0}")]
    Simulator(String),
}

/// Hex-decode a `0x…` or bare-hex string. Returns a clear domain error
/// so the handler can choose the right HTTP status.
fn decode_hex(s: &str) -> Result<Vec<u8>, RelayRejection> {
    hex::decode(s.strip_prefix("0x").unwrap_or(s))
        .map_err(|_| RelayRejection::InvalidHex)
}

/// Pure pipeline: everything a meta-tx has to pass before we queue it.
///
/// Does not touch Actix — takes already-decoded inputs and trait
/// objects so tests can inject mock simulators / replay caches.
pub async fn validate_meta_tx(
    chain_id: u64,
    wallet: Address,
    calldata: &[u8],
    simulator: &dyn TransactionSimulator,
    replay: &dyn ReplayCache,
) -> Result<u64, RelayRejection> {
    // 1. Parse execute() calldata.
    let parsed = parse_execute_calldata(calldata)
        .map_err(|e| RelayRejection::ParseFailure(e.to_string()))?;

    // 2. Structural validation (count, delegate_call, gas, value).
    validate_structural(&parsed)?;

    // 3. Replay protection. We claim *before* the simulator round-trip
    //    so a flood of duplicates can't tie up RPC bandwidth.
    let nonce = parsed.nonce;
    match replay.claim(chain_id, wallet, nonce).await {
        Ok(()) => {}
        Err(ReplayError::AlreadySeen) => {
            return Err(RelayRejection::Replay {
                chain_id,
                wallet,
                nonce: nonce.to_string(),
            });
        }
        Err(ReplayError::Backend(e)) => {
            return Err(RelayRejection::ReplayBackend(e));
        }
    }

    // 4. On-chain signature verification via eth_call. The wallet's
    //    own _validateSignature is the ground truth; we just ask it.
    let sim = simulator
        .simulate(wallet, Bytes::from(calldata.to_vec()), chain_id)
        .await
        .map_err(|e| RelayRejection::Simulator(e.to_string()))?;
    if !sim.success {
        return Err(RelayRejection::SimulationReverted(
            sim.error.unwrap_or_else(|| "unknown revert".to_string()),
        ));
    }

    Ok(sim.gas_used.as_u64())
}

/// `POST /api/v1/transactions` — HTTP wrapper around [`validate_meta_tx`].
pub async fn handler(
    ctx: web::Data<RelayerContext>,
    body: web::Json<SendTxRequest>,
) -> HttpResponse {
    let req = body.into_inner();

    // Parse address + calldata up-front; invalid inputs => 400.
    let wallet = match Address::from_str(&req.wallet_address) {
        Ok(a) => a,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "invalid wallet_address"}));
        }
    };
    let calldata_bytes = match decode_hex(&req.calldata) {
        Ok(b) => b,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "invalid calldata hex"}));
        }
    };

    // Build the chain-specific simulator. A wallet that lives on a
    // chain we have no RPC for cannot be verified — refuse rather
    // than silently skip.
    let rpc_url = match rpc_url_for_chain(&ctx.config, req.chain_id) {
        Some(u) => u.to_string(),
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("unsupported or unconfigured chainId: {}", req.chain_id),
            }));
        }
    };
    let simulator = match ContractSimulator::new(&rpc_url) {
        Ok(s) => s,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("simulator init: {}", e)}));
        }
    };
    let replay = RedisReplayCache::new(ctx.redis_pool());

    match validate_meta_tx(
        req.chain_id,
        wallet,
        &calldata_bytes,
        &simulator,
        &replay,
    )
    .await
    {
        Ok(gas_used) => {
            tracing::info!(
                chain_id = req.chain_id,
                wallet = %req.wallet_address,
                gas_used,
                "meta-tx accepted"
            );
            // TODO: push onto Redis stream for async broadcast.
            HttpResponse::Ok().json(serde_json::json!({
                "status": "queued",
                "gasEstimate": gas_used.to_string(),
            }))
        }
        Err(e) => {
            tracing::warn!(
                chain_id = req.chain_id,
                wallet = %req.wallet_address,
                reason = %e,
                "meta-tx rejected"
            );
            let (status, msg) = match &e {
                RelayRejection::Replay { .. } => (409, e.to_string()),
                RelayRejection::SimulationReverted(_) => (422, e.to_string()),
                RelayRejection::ReplayBackend(_) | RelayRejection::Simulator(_) => {
                    (503, e.to_string())
                }
                _ => (400, e.to_string()),
            };
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(serde_json::json!({"error": msg}))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::replay::InMemoryReplayCache;
    use async_trait::async_trait;
    use ethers::types::U256;
    use execute_validator::simulator::SimulationResult;

    /// Mock simulator that returns a scripted outcome so we can
    /// exercise `validate_meta_tx` without a live RPC.
    struct MockSim {
        success: bool,
        err: Option<String>,
    }

    #[async_trait]
    impl TransactionSimulator for MockSim {
        async fn simulate(
            &self,
            _wallet: Address,
            _calldata: Bytes,
            _chain_id: u64,
        ) -> anyhow::Result<SimulationResult> {
            Ok(SimulationResult {
                success: self.success,
                gas_used: U256::from(123_456),
                return_data: Bytes::new(),
                error: self.err.clone(),
            })
        }
    }

    /// Build a minimal but valid `execute(_txs, _nonce, _signature)`
    /// calldata with one inner transaction. The inner tx has
    /// delegate_call=false, revert_on_error=true, gas_limit=100_000,
    /// target=0x00…01, value=0, data=empty.
    fn build_execute_calldata(nonce: u64) -> Vec<u8> {
        use ethers::abi::{encode, Token};

        // Inner tx packed format:
        //   [delegate_call:1][revert_on_error:1][gas_limit:32]
        //   [target:20][value:32][data_len:32][data:N]
        let mut inner = Vec::with_capacity(86);
        inner.push(0); // delegate_call = false
        inner.push(1); // revert_on_error = true
        let mut gas = [0u8; 32];
        U256::from(100_000u64).to_big_endian(&mut gas);
        inner.extend_from_slice(&gas);
        let mut target = [0u8; 20];
        target[19] = 1;
        inner.extend_from_slice(&target);
        inner.extend_from_slice(&[0u8; 32]); // value
        inner.extend_from_slice(&[0u8; 32]); // data_len = 0

        let encoded = encode(&[
            Token::Bytes(inner),
            Token::Uint(U256::from(nonce)),
            Token::Bytes(vec![0x11; 65]), // fake inner signature, 65 bytes
        ]);

        let mut out = Vec::with_capacity(4 + encoded.len());
        out.extend_from_slice(&[0x1f, 0x6a, 0x1e, 0xb9]); // execute selector
        out.extend_from_slice(&encoded);
        out
    }

    #[tokio::test]
    async fn happy_path_passes() {
        let cd = build_execute_calldata(1);
        let replay = InMemoryReplayCache::new();
        let sim = MockSim { success: true, err: None };
        let out = validate_meta_tx(1, Address::zero(), &cd, &sim, &replay).await;
        assert!(matches!(out, Ok(123_456)), "got {:?}", out);
    }

    #[tokio::test]
    async fn replay_second_submit_rejected() {
        let cd = build_execute_calldata(42);
        let replay = InMemoryReplayCache::new();
        let sim = MockSim { success: true, err: None };

        let first = validate_meta_tx(1, Address::zero(), &cd, &sim, &replay).await;
        assert!(first.is_ok(), "first submission should succeed: {:?}", first);

        let second = validate_meta_tx(1, Address::zero(), &cd, &sim, &replay).await;
        assert!(
            matches!(second, Err(RelayRejection::Replay { .. })),
            "got {:?}",
            second,
        );
    }

    #[tokio::test]
    async fn simulation_revert_rejected() {
        let cd = build_execute_calldata(7);
        let replay = InMemoryReplayCache::new();
        let sim = MockSim {
            success: false,
            err: Some("InvalidSignature".to_string()),
        };
        let out = validate_meta_tx(1, Address::zero(), &cd, &sim, &replay).await;
        assert!(
            matches!(out, Err(RelayRejection::SimulationReverted(ref e)) if e.contains("InvalidSignature")),
            "got {:?}",
            out,
        );
    }

    #[tokio::test]
    async fn bad_selector_rejected() {
        let mut cd = build_execute_calldata(1);
        cd[0] = 0xff; // corrupt selector
        let replay = InMemoryReplayCache::new();
        let sim = MockSim { success: true, err: None };
        let out = validate_meta_tx(1, Address::zero(), &cd, &sim, &replay).await;
        assert!(
            matches!(out, Err(RelayRejection::ParseFailure(_))),
            "got {:?}",
            out,
        );
    }

    #[tokio::test]
    async fn empty_calldata_rejected() {
        let replay = InMemoryReplayCache::new();
        let sim = MockSim { success: true, err: None };
        let out = validate_meta_tx(1, Address::zero(), &[], &sim, &replay).await;
        assert!(matches!(out, Err(RelayRejection::ParseFailure(_))));
    }

    /// A calldata-with-delegate_call must be rejected *before* we
    /// reach the simulator — a legitimate signature on an inner
    /// delegate_call would otherwise drain the wallet.
    #[tokio::test]
    async fn delegate_call_rejected_before_simulator() {
        use ethers::abi::{encode, Token};

        let mut inner = Vec::with_capacity(86);
        inner.push(1); // delegate_call = TRUE (forbidden)
        inner.push(1);
        let mut gas = [0u8; 32];
        U256::from(100_000u64).to_big_endian(&mut gas);
        inner.extend_from_slice(&gas);
        let mut target = [0u8; 20];
        target[19] = 1;
        inner.extend_from_slice(&target);
        inner.extend_from_slice(&[0u8; 32]);
        inner.extend_from_slice(&[0u8; 32]);

        let encoded = encode(&[
            Token::Bytes(inner),
            Token::Uint(U256::from(1)),
            Token::Bytes(vec![0x11; 65]),
        ]);
        let mut cd = vec![0x1f, 0x6a, 0x1e, 0xb9];
        cd.extend_from_slice(&encoded);

        let replay = InMemoryReplayCache::new();
        // Simulator would accept — we must reject *before* reaching it.
        let sim = MockSim { success: true, err: None };
        let out = validate_meta_tx(1, Address::zero(), &cd, &sim, &replay).await;
        assert!(
            matches!(
                out,
                Err(RelayRejection::Structural(
                    ValidationError::DelegateCallForbidden { idx: 0 }
                ))
            ),
            "got {:?}",
            out,
        );
    }
}

