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

/// Why the consumer should XACK an entry.
///
/// Both variants remove the entry from the PEL so the stream
/// doesn't redeliver it; the enum variant just tells operator
/// logs / metrics which branch happened.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AckReason {
    /// Happy path: the broadcaster returned a tx hash. We XACK
    /// so the entry leaves the PEL. The hash is kept for the
    /// audit log line.
    Success(TxHash),
    /// Terminal failure: the entry was malformed in a way retries
    /// can't fix. We XACK so the stream doesn't redeliver the
    /// same bad message forever. The message is logged at
    /// ERROR level so operators can grep for it.
    Poisoned(String),
}

/// Why the consumer should leave an entry in the PEL.
///
/// Both variants mean: do NOT XACK. Next XREADGROUP will
/// redeliver the same entry with an `idle` count bump, so
/// stuck entries show up in `XPENDING` output for debugging.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RetainReason {
    /// The broadcaster said it can't process yet (e.g.
    /// NoopTxBroadcaster during rollout). Retry next tick.
    NotImplemented(&'static str),
    /// Network / RPC flake. Retry next tick.
    Transient(String),
}

/// The consumer's per-entry action.
///
/// `consume_once_with_broadcaster` (see relayer-redis lib.rs in
/// a future PR) will walk these and execute the XACKs / logs
/// accordingly. Keeping the decision as a typed value means the
/// classification logic is unit-testable in isolation — no
/// Redis connection needed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EntryAction {
    Ack {
        stream_id: String,
        reason: AckReason,
    },
    Retain {
        stream_id: String,
        reason: RetainReason,
    },
}

/// Run `broadcaster.broadcast()` on each parsed entry and
/// produce the list of XACK / retain decisions.
///
/// This is the composable middle layer between `parse_stream_entry`
/// and the eventual consume_once Redis driver. Testable with
/// NoopTxBroadcaster + a ScriptedTxBroadcaster that yields a
/// fixed outcome per call — no I/O, no network.
pub async fn process_entries<B: TxBroadcaster>(
    broadcaster: &B,
    entries: Vec<TxStreamEntry>,
) -> Vec<EntryAction> {
    let mut actions = Vec::with_capacity(entries.len());
    for entry in entries {
        let action = match broadcaster.broadcast(&entry).await {
            Ok(tx_hash) => EntryAction::Ack {
                stream_id: entry.stream_id,
                reason: AckReason::Success(tx_hash),
            },
            Err(BroadcastError::InvalidInput(msg)) => EntryAction::Ack {
                stream_id: entry.stream_id,
                reason: AckReason::Poisoned(msg),
            },
            Err(BroadcastError::Transient(msg)) => EntryAction::Retain {
                stream_id: entry.stream_id,
                reason: RetainReason::Transient(msg),
            },
            Err(BroadcastError::NotImplemented(why)) => EntryAction::Retain {
                stream_id: entry.stream_id,
                reason: RetainReason::NotImplemented(why),
            },
        };
        actions.push(action);
    }
    actions
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

    /// Broadcaster that yields a pre-set sequence of results
    /// (one per call). Used to drive process_entries() through
    /// each variant deterministically.
    struct ScriptedBroadcaster {
        outcomes: std::sync::Mutex<Vec<Result<TxHash, BroadcastError>>>,
    }
    impl ScriptedBroadcaster {
        fn new(outcomes: Vec<Result<TxHash, BroadcastError>>) -> Self {
            Self {
                outcomes: std::sync::Mutex::new(outcomes.into_iter().rev().collect()),
            }
        }
    }
    #[async_trait::async_trait]
    impl TxBroadcaster for ScriptedBroadcaster {
        async fn broadcast(&self, _entry: &TxStreamEntry) -> Result<TxHash, BroadcastError> {
            self.outcomes.lock().unwrap().pop().expect("no scripted outcome")
        }
    }

    fn mk_entry(id: &str) -> TxStreamEntry {
        TxStreamEntry {
            stream_id: id.into(),
            chain_id: 1,
            wallet: "0x1111111111111111111111111111111111111111".into(),
            calldata_hex: "0x00".into(),
        }
    }

    #[tokio::test]
    async fn process_entries_empty_yields_empty_actions() {
        let actions = process_entries(&NoopTxBroadcaster, vec![]).await;
        assert!(actions.is_empty());
    }

    #[tokio::test]
    async fn noop_entries_all_retain_not_implemented() {
        let entries = vec![mk_entry("1-0"), mk_entry("2-0"), mk_entry("3-0")];
        let actions = process_entries(&NoopTxBroadcaster, entries).await;
        assert_eq!(actions.len(), 3);
        for (i, action) in actions.iter().enumerate() {
            match action {
                EntryAction::Retain {
                    stream_id,
                    reason: RetainReason::NotImplemented(_),
                } => {
                    assert!(stream_id.starts_with(&format!("{}-", i + 1)));
                }
                other => panic!("entry {i}: expected Retain(NotImplemented), got {other:?}"),
            }
        }
    }

    #[tokio::test]
    async fn ok_entry_yields_ack_success_with_tx_hash() {
        let b = ScriptedBroadcaster::new(vec![Ok("0xdeadbeef".into())]);
        let actions = process_entries(&b, vec![mk_entry("1-0")]).await;
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            EntryAction::Ack {
                stream_id,
                reason: AckReason::Success(tx_hash),
            } => {
                assert_eq!(stream_id, "1-0");
                assert_eq!(tx_hash, "0xdeadbeef");
            }
            other => panic!("expected Ack(Success), got {other:?}"),
        }
    }

    #[tokio::test]
    async fn invalid_input_yields_ack_poisoned() {
        let b = ScriptedBroadcaster::new(vec![Err(BroadcastError::InvalidInput(
            "bad calldata".into(),
        ))]);
        let actions = process_entries(&b, vec![mk_entry("1-0")]).await;
        match &actions[0] {
            EntryAction::Ack {
                reason: AckReason::Poisoned(msg),
                ..
            } => assert!(msg.contains("bad calldata")),
            other => panic!("expected Ack(Poisoned), got {other:?}"),
        }
    }

    #[tokio::test]
    async fn transient_yields_retain_not_ack() {
        // This is the load-bearing invariant: a Transient failure
        // MUST NOT produce an Ack, or we'd silently drop the tx.
        let b = ScriptedBroadcaster::new(vec![Err(BroadcastError::Transient(
            "rpc timeout".into(),
        ))]);
        let actions = process_entries(&b, vec![mk_entry("1-0")]).await;
        match &actions[0] {
            EntryAction::Retain {
                reason: RetainReason::Transient(msg),
                ..
            } => assert!(msg.contains("rpc timeout")),
            other => panic!("transient must map to Retain, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn mixed_batch_classifies_each_independently() {
        // Walk all four branches in one call: Ok, InvalidInput,
        // Transient, NotImplemented. The per-entry decisions must
        // not bleed into each other.
        let b = ScriptedBroadcaster::new(vec![
            Ok("0xaaaa".into()),
            Err(BroadcastError::InvalidInput("x".into())),
            Err(BroadcastError::Transient("y".into())),
            Err(BroadcastError::NotImplemented("z")),
        ]);
        let entries = vec![
            mk_entry("1-0"),
            mk_entry("2-0"),
            mk_entry("3-0"),
            mk_entry("4-0"),
        ];
        let actions = process_entries(&b, entries).await;
        assert!(matches!(
            &actions[0],
            EntryAction::Ack {
                reason: AckReason::Success(_),
                ..
            }
        ));
        assert!(matches!(
            &actions[1],
            EntryAction::Ack {
                reason: AckReason::Poisoned(_),
                ..
            }
        ));
        assert!(matches!(
            &actions[2],
            EntryAction::Retain {
                reason: RetainReason::Transient(_),
                ..
            }
        ));
        assert!(matches!(
            &actions[3],
            EntryAction::Retain {
                reason: RetainReason::NotImplemented(_),
                ..
            }
        ));
    }
}
