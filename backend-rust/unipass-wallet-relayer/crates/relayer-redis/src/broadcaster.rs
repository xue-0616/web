//! `TxBroadcaster` trait — the seam between the Redis stream
//! consumer and the Ethereum signing / broadcasting code.
//!
//! # MED-RL-3 scaffold (round 10)
//!
//! Mirrors the farm-seq `BatchTxBuilder` pattern (crates/utils/
//! src/pools_manager/batch_tx_builder.rs). Same design goals:
//!
//!   * The full pipeline (XREADGROUP → deserialize → sign →
//!     eth_sendRawTransaction → XACK) is multi-session work
//!     that needs a real Ethereum RPC + `SecurePrivateKey`
//!     signer + nonce manager.
//!   * Until the real thing lands, every message that hits
//!     `relayer:tx_stream` must stay in the pending state so
//!     operators can see the backlog grow (MED-RL-3 fail-loud
//!     stub). A silent drain would lose transactions.
//!   * This module lays down the trait + error taxonomy + a
//!     pure-function parser for stream entries so the real
//!     implementation drops in as one `impl TxBroadcaster`
//!     without having to re-design the consumer.
//!
//! # Security notes
//!
//! * `parse_stream_entry` is **pure** — no network, no DB, no
//!   clock. Malformed entries must round-trip deterministically
//!   to `BroadcastError::InvalidInput` so bad payloads don't
//!   wedge the consumer on a retry loop.
//!
//! * The trait is `async` + `Send + Sync` so one instance can
//!   be shared across the background tokio task.
//!
//! * Every `BroadcastError` variant carries recovery semantics
//!   that `consume_once` MUST respect:
//!     NotImplemented -> XCLAIM/XPENDING stays as-is, next tick
//!                       retries. Safe for the NoopBroadcaster
//!                       rollout path.
//!     InvalidInput   -> XACK the message (remove from pending)
//!                       and record the failure reason somewhere
//!                       operators can grep — a malformed message
//!                       will never succeed on retry.
//!     Transient      -> don't XACK; next tick's XREADGROUP with
//!                       the same consumer will re-deliver.

use std::fmt;

/// Minimal parsed form of one `relayer:tx_stream` entry.
///
/// The stream payload format is a flat `HSET`-style map with
/// these keys. Anything else is considered InvalidInput and
/// fails fast.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TxStreamEntry {
    /// The Redis XADD id (e.g. "1712345678901-0"). Used for the
    /// eventual XACK.
    pub stream_id: String,
    /// EIP-155 chain id (e.g. 1 / 137 / 42161).
    pub chain_id: u64,
    /// 20-byte destination wallet address, hex-encoded with 0x
    /// prefix. Lower-case canonicalization is the caller's job.
    pub wallet: String,
    /// The ABI-encoded `execute()` calldata that was validated by
    /// the `/transactions/relay` handler before being XADDed.
    pub calldata_hex: String,
}

/// Failure modes a broadcaster can surface.
///
/// Variants intentionally match the shape of
/// `batch_tx_builder::BuildError` so a reader of both crates
/// sees one consistent taxonomy across the fleet.
#[derive(Debug)]
pub enum BroadcastError {
    /// The broadcaster is not yet wired up. Consumer should
    /// leave the pending entries alone so the next tick retries
    /// (once the real impl lands). Returned by
    /// `NoopTxBroadcaster` so flipping `RELAYER_CONSUMER_ENABLED=
    /// true` without a real impl is still inert — no stream
    /// entries are XACKed and nothing is broadcast.
    NotImplemented(&'static str),
    /// The stream entry was malformed (missing keys, unparseable
    /// chain_id, bad hex). Consumer XACKs the entry so the stream
    /// doesn't re-deliver it forever; the reason is logged so
    /// the operator can correlate with whatever wrote the entry.
    InvalidInput(String),
    /// Transient RPC / network failure. Consumer does NOT XACK;
    /// next tick's XREADGROUP re-delivers the same entry with
    /// the `idle > 0` flag so retries are visible in XPENDING.
    Transient(String),
}

impl fmt::Display for BroadcastError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BroadcastError::NotImplemented(s) => {
                write!(f, "broadcaster not implemented: {s}")
            }
            BroadcastError::InvalidInput(s) => write!(f, "invalid stream entry: {s}"),
            BroadcastError::Transient(s) => write!(f, "transient broadcast failure: {s}"),
        }
    }
}

impl std::error::Error for BroadcastError {}

/// Hex-encoded 32-byte tx hash returned by the broadcaster on
/// successful `eth_sendRawTransaction`. We keep it as a string
/// here so the consumer doesn't need an ethers::types dep.
pub type TxHash = String;

/// Sign and broadcast one stream entry.
///
/// Implementations must be idempotent relative to their input —
/// the consumer may call `broadcast(entry)` multiple times for
/// the same stream id during transient-retry cycles and we need
/// the resulting on-chain tx to be stable (i.e. the nonce must
/// be derived deterministically from the entry content, not a
/// clock).
#[async_trait::async_trait]
pub trait TxBroadcaster: Send + Sync {
    async fn broadcast(&self, entry: &TxStreamEntry) -> Result<TxHash, BroadcastError>;
}

/// Default implementation — does nothing, returns `NotImplemented`.
///
/// Used when `RELAYER_CONSUMER_ENABLED=true` but the real
/// signer + broadcaster is not yet plugged in. The consumer
/// will treat this the same as a Transient failure (don't
/// XACK), so the message stays in the stream and the backlog
/// grows — visible on every tick's XLEN log line.
pub struct NoopTxBroadcaster;

#[async_trait::async_trait]
impl TxBroadcaster for NoopTxBroadcaster {
    async fn broadcast(&self, _entry: &TxStreamEntry) -> Result<TxHash, BroadcastError> {
        Err(BroadcastError::NotImplemented(
            "NoopTxBroadcaster: MED-RL-3 real signing / broadcast pipeline not yet wired",
        ))
    }
}

/// Parse one raw `(stream_id, fields)` pair into a `TxStreamEntry`.
///
/// Pure function so malformed-input handling is unit-testable
/// without a Redis connection. The consumer's call site is just
/// `parse_stream_entry(id, map).map_err(...)?` — no I/O between
/// Redis and the builder, no chance to deserialize twice with
/// different semantics.
///
/// # Expected fields
///
///   chain_id      decimal string, parseable as u64
///   wallet        0x-prefixed 20-byte hex address
///   calldata_hex  0x-prefixed hex, even length
///
/// Any missing key, any unparseable value, any wrong-length
/// hex → `InvalidInput`. Keep the error strings informative;
/// they end up in operator logs.
pub fn parse_stream_entry(
    stream_id: impl Into<String>,
    fields: &[(String, String)],
) -> Result<TxStreamEntry, BroadcastError> {
    let get = |name: &str| -> Result<&str, BroadcastError> {
        fields
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
            .ok_or_else(|| BroadcastError::InvalidInput(format!("missing field: {name}")))
    };

    let chain_id_raw = get("chain_id")?;
    let chain_id = chain_id_raw
        .parse::<u64>()
        .map_err(|e| BroadcastError::InvalidInput(format!("chain_id not u64 ({chain_id_raw:?}): {e}")))?;

    let wallet = get("wallet")?.to_string();
    if !wallet.starts_with("0x") || wallet.len() != 42 {
        return Err(BroadcastError::InvalidInput(format!(
            "wallet must be 0x + 40 hex chars, got {} chars",
            wallet.len()
        )));
    }
    // Validate the hex suffix actually parses.
    hex::decode(&wallet[2..])
        .map_err(|e| BroadcastError::InvalidInput(format!("wallet not hex: {e}")))?;

    let calldata_hex = get("calldata_hex")?.to_string();
    if !calldata_hex.starts_with("0x") || calldata_hex.len() % 2 != 0 {
        return Err(BroadcastError::InvalidInput(format!(
            "calldata_hex must be 0x-prefixed even-length hex, got {} chars",
            calldata_hex.len()
        )));
    }
    hex::decode(&calldata_hex[2..])
        .map_err(|e| BroadcastError::InvalidInput(format!("calldata_hex not hex: {e}")))?;

    Ok(TxStreamEntry {
        stream_id: stream_id.into(),
        chain_id,
        wallet,
        calldata_hex,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kv(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn parse_happy_path() {
        let entry = parse_stream_entry(
            "1712345678901-0",
            &kv(&[
                ("chain_id", "137"),
                ("wallet", "0x1111111111111111111111111111111111111111"),
                ("calldata_hex", "0xdeadbeef"),
            ]),
        )
        .unwrap();
        assert_eq!(entry.chain_id, 137);
        assert_eq!(entry.wallet, "0x1111111111111111111111111111111111111111");
        assert_eq!(entry.calldata_hex, "0xdeadbeef");
        assert_eq!(entry.stream_id, "1712345678901-0");
    }

    #[test]
    fn parse_rejects_missing_chain_id() {
        let err = parse_stream_entry(
            "x",
            &kv(&[
                ("wallet", "0x1111111111111111111111111111111111111111"),
                ("calldata_hex", "0x00"),
            ]),
        )
        .unwrap_err();
        match err {
            BroadcastError::InvalidInput(m) => assert!(m.contains("chain_id")),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn parse_rejects_non_numeric_chain_id() {
        let err = parse_stream_entry(
            "x",
            &kv(&[
                ("chain_id", "mainnet"),
                ("wallet", "0x1111111111111111111111111111111111111111"),
                ("calldata_hex", "0x00"),
            ]),
        )
        .unwrap_err();
        assert!(matches!(err, BroadcastError::InvalidInput(_)));
    }

    #[test]
    fn parse_rejects_wallet_wrong_length() {
        for bad in ["0x1234", "0x00000000000000000000000000000000000000001", "nohex"] {
            let err = parse_stream_entry(
                "x",
                &kv(&[
                    ("chain_id", "1"),
                    ("wallet", bad),
                    ("calldata_hex", "0x00"),
                ]),
            )
            .unwrap_err();
            assert!(
                matches!(err, BroadcastError::InvalidInput(_)),
                "wallet={bad} must reject"
            );
        }
    }

    #[test]
    fn parse_rejects_non_hex_wallet() {
        let err = parse_stream_entry(
            "x",
            &kv(&[
                ("chain_id", "1"),
                ("wallet", "0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
                ("calldata_hex", "0x00"),
            ]),
        )
        .unwrap_err();
        assert!(matches!(err, BroadcastError::InvalidInput(_)));
    }

    #[test]
    fn parse_rejects_odd_length_calldata() {
        let err = parse_stream_entry(
            "x",
            &kv(&[
                ("chain_id", "1"),
                ("wallet", "0x1111111111111111111111111111111111111111"),
                ("calldata_hex", "0xabc"),
            ]),
        )
        .unwrap_err();
        assert!(matches!(err, BroadcastError::InvalidInput(_)));
    }

    #[test]
    fn parse_rejects_missing_0x_prefix_on_calldata() {
        let err = parse_stream_entry(
            "x",
            &kv(&[
                ("chain_id", "1"),
                ("wallet", "0x1111111111111111111111111111111111111111"),
                ("calldata_hex", "deadbeef"),
            ]),
        )
        .unwrap_err();
        assert!(matches!(err, BroadcastError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn noop_broadcaster_returns_not_implemented() {
        let b = NoopTxBroadcaster;
        let entry = TxStreamEntry {
            stream_id: "x".into(),
            chain_id: 1,
            wallet: "0x1111111111111111111111111111111111111111".into(),
            calldata_hex: "0xdeadbeef".into(),
        };
        let err = b.broadcast(&entry).await.unwrap_err();
        match err {
            BroadcastError::NotImplemented(_) => {}
            other => panic!("expected NotImplemented, got {other:?}"),
        }
    }
}
