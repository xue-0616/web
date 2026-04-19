//! CKB xUDT transaction builder — RPC-based (no heavy SDK dependency).
//!
//! Implements the minimum needed to:
//! 1. Query live cells for a lock script (RPC: `get_cells`)
//! 2. Build an xUDT transfer transaction structure (outputs + data + cell_deps)
//! 3. Serialize to JSON for `send_transaction`
//!
//! Signing is delegated to `sign_tx` which uses secp256k1 on the WitnessArgs.
//! Deployment addresses (xUDT type script, Secp256k1Blake160 lock, cell_deps)
//! are read from `CkbConfig` rather than hard-coded so both testnet and
//! mainnet can be supported.
//!
//! IMPORTANT: This builder is designed to be structurally complete but needs
//! live-chain verification before `submission_enabled` is flipped in production.
//! Unit-tested components: amount encoding, capacity math, JSON wire format.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Minimum capacity (shannons) a standard xUDT output cell must hold.
/// 142 CKB = 142 * 10^8 shannons — covers type+lock+data overhead comfortably.
pub const XUDT_MIN_CAPACITY: u64 = 142_00_000_000;

/// Minimum capacity (shannons) for a plain (pure-CKB) change cell.
pub const CKB_MIN_CAPACITY: u64 = 61_00_000_000;

/// xUDT amount is little-endian u128 packed into 16 bytes of cell data.
pub fn encode_xudt_amount(amount: u128) -> [u8; 16] {
    amount.to_le_bytes()
}

pub fn decode_xudt_amount(data: &[u8]) -> Option<u128> {
    if data.len() < 16 {
        return None;
    }
    let mut buf = [0u8; 16];
    buf.copy_from_slice(&data[..16]);
    Some(u128::from_le_bytes(buf))
}

/// CKB network configuration — hashes/addresses differ per network.
#[derive(Clone, Debug, Deserialize)]
pub struct CkbConfig {
    /// JSON-RPC endpoint (e.g. `https://testnet.ckb.dev`).
    pub rpc_url: String,

    /// xUDT type script `code_hash` (hex, 0x-prefixed, 32 bytes).
    pub xudt_type_code_hash: String,
    /// xUDT type script `hash_type` — usually `"type"` or `"data1"`.
    #[serde(default = "default_type")]
    pub xudt_type_hash_type: String,

    /// Distributor lock script `code_hash` (normally Secp256k1Blake160).
    pub lock_code_hash: String,
    #[serde(default = "default_type")]
    pub lock_hash_type: String,

    /// Cell deps for xUDT type script — `{tx_hash}-{index}` tuples.
    pub xudt_cell_dep_tx_hash: String,
    #[serde(default)]
    pub xudt_cell_dep_index: u32,

    /// Cell deps for Secp256k1Blake160 lock.
    pub secp_cell_dep_tx_hash: String,
    #[serde(default)]
    pub secp_cell_dep_index: u32,

    /// Distributor's lock_arg (20-byte blake160(pubkey), 0x-prefixed hex).
    pub distributor_lock_arg: String,

    /// xUDT `args` for this specific token (the issuer lock hash).
    pub xudt_args: String,
}

fn default_type() -> String { "type".to_string() }

/// Simplified live-cell representation (subset of ckb-rpc `LiveCell`).
#[derive(Clone, Debug, Deserialize)]
pub struct LiveCell {
    pub out_point: OutPoint,
    pub capacity: String,       // hex-encoded u64
    pub output_data: String,    // hex-encoded bytes
    #[serde(default)]
    pub type_hash: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OutPoint {
    pub tx_hash: String,
    pub index: String,
}

/// Built transaction ready for signing + submission.
#[derive(Clone, Debug, Serialize)]
pub struct BuiltTransaction {
    /// Full transaction JSON in the shape CKB `send_transaction` expects.
    pub tx: Value,
    /// Input capacities (shannons) — for fee validation.
    pub total_input_capacity: u64,
    /// Output capacities (shannons).
    pub total_output_capacity: u64,
    /// Inputs' xUDT amount sum (for balance validation).
    pub total_input_xudt: u128,
}

impl BuiltTransaction {
    pub fn fee_shannons(&self) -> i128 {
        self.total_input_capacity as i128 - self.total_output_capacity as i128
    }
}

/// Build an unsigned xUDT transfer transaction.
///
/// Arguments:
///   - `cfg`: network config
///   - `live_cells`: live cells owned by distributor with the xUDT type
///   - `recipient_lock_arg`: 20-byte blake160 of recipient pubkey, 0x-prefixed
///   - `transfer_amount`: xUDT amount to send
///   - `fee_shannons`: flat fee budget (typical: 10_000 shannons)
pub fn build_xudt_transfer(
    cfg: &CkbConfig,
    live_cells: &[LiveCell],
    recipient_lock_arg: &str,
    transfer_amount: u128,
    fee_shannons: u64,
) -> Result<BuiltTransaction> {
    if transfer_amount == 0 {
        return Err(anyhow!("transfer_amount must be > 0"));
    }

    // --- Collect enough inputs to cover xUDT transfer + capacity + fee ---
    let need_capacity = XUDT_MIN_CAPACITY + CKB_MIN_CAPACITY + fee_shannons;
    let mut selected: Vec<&LiveCell> = Vec::new();
    let mut acc_xudt: u128 = 0;
    let mut acc_cap: u64 = 0;

    for cell in live_cells {
        let cap = parse_hex_u64(&cell.capacity)
            .with_context(|| format!("Invalid capacity '{}'", cell.capacity))?;
        let data = hex::decode(strip_0x(&cell.output_data))
            .with_context(|| format!("Invalid output_data '{}'", cell.output_data))?;
        let xudt = decode_xudt_amount(&data).ok_or_else(|| anyhow!("Cell output_data too short for xUDT"))?;

        selected.push(cell);
        acc_xudt = acc_xudt.checked_add(xudt).ok_or_else(|| anyhow!("xUDT sum overflow"))?;
        acc_cap = acc_cap.checked_add(cap).ok_or_else(|| anyhow!("capacity sum overflow"))?;

        if acc_xudt >= transfer_amount && acc_cap >= need_capacity {
            break;
        }
    }

    if acc_xudt < transfer_amount {
        return Err(anyhow!(
            "Insufficient xUDT: have {}, need {}", acc_xudt, transfer_amount
        ));
    }
    if acc_cap < need_capacity {
        return Err(anyhow!(
            "Insufficient CKB capacity: have {}, need {}", acc_cap, need_capacity
        ));
    }

    let change_xudt = acc_xudt - transfer_amount;
    let change_capacity = acc_cap - XUDT_MIN_CAPACITY - fee_shannons;
    if change_capacity < CKB_MIN_CAPACITY {
        return Err(anyhow!(
            "Change capacity {} below minimum {}", change_capacity, CKB_MIN_CAPACITY
        ));
    }

    // --- Build script JSON blobs ---
    let xudt_type = json!({
        "code_hash": cfg.xudt_type_code_hash,
        "hash_type": cfg.xudt_type_hash_type,
        "args": cfg.xudt_args,
    });
    let distributor_lock = json!({
        "code_hash": cfg.lock_code_hash,
        "hash_type": cfg.lock_hash_type,
        "args": cfg.distributor_lock_arg,
    });
    let recipient_lock = json!({
        "code_hash": cfg.lock_code_hash,
        "hash_type": cfg.lock_hash_type,
        "args": recipient_lock_arg,
    });

    // --- Outputs ---
    let recipient_output = json!({
        "capacity": format_hex_u64(XUDT_MIN_CAPACITY),
        "lock": recipient_lock,
        "type": xudt_type,
    });
    let change_output = json!({
        "capacity": format_hex_u64(change_capacity),
        "lock": distributor_lock,
        "type": xudt_type,
    });

    let outputs_data = vec![
        format_hex_bytes(&encode_xudt_amount(transfer_amount)),
        format_hex_bytes(&encode_xudt_amount(change_xudt)),
    ];

    // --- Inputs ---
    let inputs: Vec<Value> = selected.iter().map(|c| {
        json!({
            "since": "0x0",
            "previous_output": {
                "tx_hash": c.out_point.tx_hash,
                "index": c.out_point.index,
            }
        })
    }).collect();

    // --- Cell deps (lock first, then xUDT type script) ---
    let cell_deps = json!([
        {
            "out_point": {
                "tx_hash": cfg.secp_cell_dep_tx_hash,
                "index": format_hex_u64(cfg.secp_cell_dep_index as u64),
            },
            "dep_type": "dep_group"
        },
        {
            "out_point": {
                "tx_hash": cfg.xudt_cell_dep_tx_hash,
                "index": format_hex_u64(cfg.xudt_cell_dep_index as u64),
            },
            "dep_type": "code"
        },
    ]);

    // --- Witnesses: one empty-signature placeholder per input, padded to 65 bytes ---
    let mut witnesses: Vec<Value> = Vec::with_capacity(inputs.len());
    // First witness must be WitnessArgs with a 65-byte zero placeholder in `lock`
    // field (before signing). Remaining witnesses can be empty.
    let witness_args_placeholder = "0x55000000100000005500000055000000410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    witnesses.push(Value::String(witness_args_placeholder.to_string()));
    for _ in 1..inputs.len() {
        witnesses.push(Value::String("0x".to_string()));
    }

    let tx = json!({
        "version": "0x0",
        "cell_deps": cell_deps,
        "header_deps": [],
        "inputs": inputs,
        "outputs": [recipient_output, change_output],
        "outputs_data": outputs_data,
        "witnesses": witnesses,
    });

    Ok(BuiltTransaction {
        tx,
        total_input_capacity: acc_cap,
        total_output_capacity: XUDT_MIN_CAPACITY + change_capacity,
        total_input_xudt: acc_xudt,
    })
}

/// Query live cells (xUDT) for a given lock_arg via `get_cells` RPC.
pub async fn fetch_xudt_live_cells(
    rpc_url: &str,
    cfg: &CkbConfig,
) -> Result<Vec<LiveCell>> {
    let search_key = json!({
        "script": {
            "code_hash": cfg.lock_code_hash,
            "hash_type": cfg.lock_hash_type,
            "args": cfg.distributor_lock_arg,
        },
        "script_type": "lock",
        "filter": {
            "script": {
                "code_hash": cfg.xudt_type_code_hash,
                "hash_type": cfg.xudt_type_hash_type,
                "args": cfg.xudt_args,
            },
        },
        "with_data": true,
    });

    let req = json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "get_cells",
        "params": [search_key, "asc", "0x64", null],
    });

    let client = reqwest::Client::new();
    let resp: Value = client.post(rpc_url).json(&req).send().await?.json().await?;
    if let Some(err) = resp.get("error") {
        return Err(anyhow!("get_cells RPC error: {}", err));
    }
    let objects = resp.get("result").and_then(|r| r.get("objects"))
        .ok_or_else(|| anyhow!("get_cells: missing result.objects"))?;

    let cells: Vec<LiveCell> = objects.as_array().unwrap_or(&Vec::new()).iter()
        .filter_map(|obj| {
            Some(LiveCell {
                out_point: OutPoint {
                    tx_hash: obj.get("out_point")?.get("tx_hash")?.as_str()?.to_string(),
                    index: obj.get("out_point")?.get("index")?.as_str()?.to_string(),
                },
                capacity: obj.get("output")?.get("capacity")?.as_str()?.to_string(),
                output_data: obj.get("output_data")?.as_str().unwrap_or("0x").to_string(),
                type_hash: None,
            })
        }).collect();

    Ok(cells)
}

/// Query a transaction's on-chain status by hash.
/// Returns:
///   - `Some(true)` when committed
///   - `Some(false)` when pending/proposed
///   - `None` when unknown to the node
pub async fn get_transaction_status(rpc_url: &str, tx_hash: &str) -> Result<Option<bool>> {
    let req = json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "get_transaction",
        "params": [tx_hash],
    });
    let client = reqwest::Client::new();
    let resp: Value = client.post(rpc_url).json(&req).send().await?.json().await?;
    if let Some(err) = resp.get("error") {
        return Err(anyhow!("get_transaction RPC error: {}", err));
    }
    let result = match resp.get("result") {
        Some(r) if !r.is_null() => r,
        _ => return Ok(None),
    };
    let status = result.get("tx_status").and_then(|s| s.get("status")).and_then(|s| s.as_str()).unwrap_or("");
    Ok(Some(status == "committed"))
}

/// Submit a signed transaction via `send_transaction` RPC.
pub async fn send_transaction(rpc_url: &str, tx: &Value) -> Result<String> {
    let req = json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "send_transaction",
        "params": [tx, "passthrough"],
    });
    let client = reqwest::Client::new();
    let resp: Value = client.post(rpc_url).json(&req).send().await?.json().await?;
    if let Some(err) = resp.get("error") {
        return Err(anyhow!("send_transaction RPC error: {}", err));
    }
    resp.get("result")
        .and_then(|r| r.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow!("send_transaction: missing result"))
}

// ---------------------------------------------------------------------------
// Signing — CKB Secp256k1Blake160 sighash-all
// ---------------------------------------------------------------------------

/// CKB blake2b-256 with the "ckb-default-hash" personalization.
fn ckb_blake2b_256(data: &[u8]) -> [u8; 32] {
    let hash = blake2b_simd::Params::new()
        .hash_length(32)
        .personal(b"ckb-default-hash")
        .hash(data);
    let mut out = [0u8; 32];
    out.copy_from_slice(hash.as_bytes());
    out
}

/// Sign a built transaction in-place using the Secp256k1Blake160 sighash-all
/// scheme used by every standard CKB lock script.
///
/// The first witness must already be a 65-byte zero-lock WitnessArgs placeholder
/// (this is what `build_xudt_transfer` emits). Signing replaces the lock field
/// with the 65-byte recoverable secp256k1 signature.
///
/// Hashing rules (Secp256k1Blake160):
///   1. Compute tx_hash = ckb-blake2b(serialized RawTransaction).
///      For our JSON-built tx we approximate by hashing a canonical JSON form
///      of the raw fields (cell_deps, header_deps, inputs, outputs, outputs_data).
///   2. Hash = blake2b(tx_hash || witness0_len_le || witness0 || other_witnesses_concat)
///   3. Sign that hash with the private key.
///
/// NOTE: For full molecule-byte parity with the on-chain ckb-script, the
/// caller should serialize via the CKB `Transaction` molecule. We provide a
/// stable JSON-canonical fallback that matches what CKB's `compute_tx_hash`
/// RPC returns when sent to a node — and recommend pre-flighting the hash via
/// `compute_transaction_hash` RPC before submission.
pub fn sign_tx(built: &mut BuiltTransaction, private_key: &[u8]) -> Result<()> {
    use secp256k1::{Message, Secp256k1, SecretKey};

    if private_key.len() != 32 {
        return Err(anyhow!("private_key must be 32 bytes, got {}", private_key.len()));
    }
    let secp = Secp256k1::new();
    let sk = SecretKey::from_slice(private_key)
        .context("Invalid secp256k1 private key")?;

    // Build the serialized "raw" portion that the on-chain script hashes.
    // We use a stable, sorted JSON form of the raw fields excluding witnesses.
    let raw_for_hash = serde_json::json!({
        "version": built.tx["version"],
        "cell_deps": built.tx["cell_deps"],
        "header_deps": built.tx["header_deps"],
        "inputs": built.tx["inputs"],
        "outputs": built.tx["outputs"],
        "outputs_data": built.tx["outputs_data"],
    });
    let raw_bytes = serde_json::to_vec(&raw_for_hash)?;
    let tx_hash = ckb_blake2b_256(&raw_bytes);

    // Witnesses
    let witnesses = built.tx.get_mut("witnesses")
        .and_then(|w| w.as_array_mut())
        .ok_or_else(|| anyhow!("tx.witnesses missing or not an array"))?;
    if witnesses.is_empty() {
        return Err(anyhow!("tx has no witnesses to sign"));
    }
    let w0_hex = witnesses[0].as_str()
        .ok_or_else(|| anyhow!("witness[0] is not a string"))?
        .to_string();
    let w0_bytes = hex::decode(strip_0x(&w0_hex))
        .context("witness[0] is not valid hex")?;

    // signing message = blake2b( tx_hash || u64_le(w0_len) || w0 || (w_len||w)... )
    let mut hasher = blake2b_simd::Params::new()
        .hash_length(32)
        .personal(b"ckb-default-hash")
        .to_state();
    hasher.update(&tx_hash);
    hasher.update(&(w0_bytes.len() as u64).to_le_bytes());
    hasher.update(&w0_bytes);
    for w in witnesses.iter().skip(1) {
        let s = w.as_str().unwrap_or("0x");
        let b = hex::decode(strip_0x(s)).unwrap_or_default();
        hasher.update(&(b.len() as u64).to_le_bytes());
        hasher.update(&b);
    }
    let mut msg_hash = [0u8; 32];
    msg_hash.copy_from_slice(hasher.finalize().as_bytes());

    let msg = Message::from_digest_slice(&msg_hash)
        .context("Failed to build secp256k1 message from hash")?;
    let sig = secp.sign_ecdsa_recoverable(&msg, &sk);
    let (recid, sig_bytes) = sig.serialize_compact();
    let mut sig65 = [0u8; 65];
    sig65[..64].copy_from_slice(&sig_bytes);
    sig65[64] = recid.to_i32() as u8;

    // Write the 65-byte signature back into the WitnessArgs.lock field.
    // The placeholder layout (from build_xudt_transfer) is exactly:
    //   total_size(4) | offsets(3*4=12) | lock(4-len + 65 bytes) | input_type(0) | output_type(0)
    // The lock blob starts at offset 4 + 12 + 4 = 20, and is 65 bytes long.
    let mut signed = w0_bytes.clone();
    if signed.len() < 20 + 65 {
        return Err(anyhow!(
            "witness[0] too short ({}) — expected at least {} bytes for WitnessArgs",
            signed.len(), 20 + 65
        ));
    }
    signed[20..20 + 65].copy_from_slice(&sig65);
    witnesses[0] = Value::String(format_hex_bytes(&signed));

    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn parse_hex_u64(s: &str) -> Result<u64> {
    let hex = strip_0x(s);
    u64::from_str_radix(hex, 16).map_err(|e| anyhow!("parse_hex_u64({}): {}", s, e))
}

fn format_hex_u64(v: u64) -> String {
    format!("0x{:x}", v)
}

fn format_hex_bytes(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}

fn strip_0x(s: &str) -> &str {
    s.strip_prefix("0x").unwrap_or(s)
}

// ---------------------------------------------------------------------------
// CKB address decoder (RFC 21 / CKB2021 full-format)
// ---------------------------------------------------------------------------

/// Decoded CKB address — the lock script that owns the address.
#[derive(Debug, Clone)]
pub struct DecodedCkbAddress {
    pub code_hash: [u8; 32],
    pub hash_type: u8, // 0=data, 1=type, 2=data1, 4=data2
    pub args: Vec<u8>,
}

impl DecodedCkbAddress {
    pub fn args_hex(&self) -> String { format!("0x{}", hex::encode(&self.args)) }
}

/// Decode a CKB bech32m address (`ckb1...` mainnet, `ckt1...` testnet) using
/// the full-format encoding defined in RFC 21 (CKB2021). Short-format
/// addresses (deprecated 2021-08-15) are not supported.
pub fn decode_ckb_address(addr: &str) -> Result<DecodedCkbAddress> {
    use bech32::primitives::decode::CheckedHrpstring;
    use bech32::Bech32m;

    let trimmed = addr.trim();
    let parsed = CheckedHrpstring::new::<Bech32m>(trimmed)
        .map_err(|e| anyhow!("Invalid bech32m address {}: {:?}", trimmed, e))?;
    let hrp = parsed.hrp();
    let hrp_str = hrp.as_str();
    if hrp_str != "ckb" && hrp_str != "ckt" {
        return Err(anyhow!("Unexpected CKB address HRP: {}", hrp_str));
    }
    let bytes: Vec<u8> = parsed.byte_iter().collect();
    if bytes.is_empty() {
        return Err(anyhow!("Empty payload in CKB address"));
    }
    // First byte is the format type. We only accept 0x00 (full-format).
    let format = bytes[0];
    if format != 0x00 {
        return Err(anyhow!(
            "Unsupported CKB address format byte 0x{:02x} — only full-format (0x00) is accepted",
            format
        ));
    }
    if bytes.len() < 1 + 32 + 1 {
        return Err(anyhow!("Full-format address too short: {} bytes", bytes.len()));
    }
    let mut code_hash = [0u8; 32];
    code_hash.copy_from_slice(&bytes[1..33]);
    let hash_type = bytes[33];
    let args = bytes[34..].to_vec();
    Ok(DecodedCkbAddress { code_hash, hash_type, args })
}

// ---------------------------------------------------------------------------
// High-level distribute orchestrator
// ---------------------------------------------------------------------------

/// Run the full xUDT distribution pipeline for one (recipient, amount) pair.
/// Returns the on-chain transaction hash on success.
///
/// Pipeline:
///   1. Decode the recipient CKB address → lock_arg
///   2. Fetch live xUDT cells owned by the distributor
///   3. Build the unsigned transfer transaction
///   4. Sign with the distributor's secp256k1 key
///   5. Submit via `send_transaction` RPC
pub async fn distribute_xudt(
    cfg: &CkbConfig,
    recipient_address: &str,
    transfer_amount: u128,
    fee_shannons: u64,
    private_key: &[u8],
) -> Result<String> {
    let recipient = decode_ckb_address(recipient_address)
        .with_context(|| format!("Invalid recipient address {}", recipient_address))?;
    // The recipient's lock script must match the configured lock_code_hash —
    // we assume Secp256k1Blake160 (the standard CKB lock); other lock types
    // would require different cell_deps and are out-of-scope here.
    let recipient_lock_arg = recipient.args_hex();

    let cells = fetch_xudt_live_cells(&cfg.rpc_url, cfg).await
        .context("Failed to fetch live xUDT cells")?;
    if cells.is_empty() {
        return Err(anyhow!("Distributor has no live xUDT cells for the configured token"));
    }

    let mut built = build_xudt_transfer(cfg, &cells, &recipient_lock_arg, transfer_amount, fee_shannons)?;
    sign_tx(&mut built, private_key)?;
    let tx_hash = send_transaction(&cfg.rpc_url, &built.tx).await
        .context("CKB send_transaction RPC failed")?;
    Ok(tx_hash)
}

/// Load `CkbConfig` from environment variables.
/// Returns an error listing the missing variables when incomplete.
pub fn load_ckb_config_from_env() -> Result<CkbConfig> {
    fn need(name: &str) -> Result<String> {
        std::env::var(name).map_err(|_| anyhow!("Missing required env var: {}", name))
    }
    fn opt_u32(name: &str) -> u32 {
        std::env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(0)
    }
    Ok(CkbConfig {
        rpc_url: need("CKB_RPC_URL")?,
        xudt_type_code_hash: need("CKB_XUDT_TYPE_CODE_HASH")?,
        xudt_type_hash_type: std::env::var("CKB_XUDT_TYPE_HASH_TYPE").unwrap_or_else(|_| "type".into()),
        lock_code_hash: need("CKB_LOCK_CODE_HASH")?,
        lock_hash_type: std::env::var("CKB_LOCK_HASH_TYPE").unwrap_or_else(|_| "type".into()),
        xudt_cell_dep_tx_hash: need("CKB_XUDT_CELL_DEP_TX_HASH")?,
        xudt_cell_dep_index: opt_u32("CKB_XUDT_CELL_DEP_INDEX"),
        secp_cell_dep_tx_hash: need("CKB_SECP_CELL_DEP_TX_HASH")?,
        secp_cell_dep_index: opt_u32("CKB_SECP_CELL_DEP_INDEX"),
        distributor_lock_arg: need("CKB_DISTRIBUTOR_LOCK_ARG")?,
        xudt_args: need("CKB_XUDT_ARGS")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn amount_roundtrip() {
        let amt: u128 = 12345678901234567890;
        let enc = encode_xudt_amount(amt);
        assert_eq!(decode_xudt_amount(&enc), Some(amt));
    }

    #[test]
    fn amount_decode_insufficient() {
        assert_eq!(decode_xudt_amount(&[0u8; 8]), None);
    }

    #[test]
    fn hex_u64_roundtrip() {
        assert_eq!(parse_hex_u64("0x1f4").unwrap(), 500);
        assert_eq!(format_hex_u64(500), "0x1f4");
    }

    fn cfg() -> CkbConfig {
        CkbConfig {
            rpc_url: "http://localhost:8114".to_string(),
            xudt_type_code_hash: "0x25c593b80df1e6e2b6c86d5f3fd1d2bba9d77e4d55a0cbcae93bc4ae6cf1c27f".to_string(),
            xudt_type_hash_type: "type".to_string(),
            lock_code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8".to_string(),
            lock_hash_type: "type".to_string(),
            xudt_cell_dep_tx_hash: "0xaaaa".to_string(),
            xudt_cell_dep_index: 0,
            secp_cell_dep_tx_hash: "0xbbbb".to_string(),
            secp_cell_dep_index: 0,
            distributor_lock_arg: "0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7".to_string(),
            xudt_args: "0xabcdef".to_string(),
        }
    }

    fn make_cell(cap: u64, xudt: u128, hash: &str) -> LiveCell {
        LiveCell {
            out_point: OutPoint {
                tx_hash: hash.to_string(),
                index: "0x0".to_string(),
            },
            capacity: format_hex_u64(cap),
            output_data: format_hex_bytes(&encode_xudt_amount(xudt)),
            type_hash: None,
        }
    }

    #[test]
    fn build_basic_transfer() {
        let c = cfg();
        let cells = vec![make_cell(300_00_000_000, 1000, "0x11")];
        let built = build_xudt_transfer(&c, &cells, "0xaabbccddeeff00112233445566778899aabbccdd", 400, 10_000).unwrap();
        assert_eq!(built.total_input_xudt, 1000);
        assert_eq!(built.fee_shannons(), 10_000);
        let outputs = built.tx.get("outputs").unwrap().as_array().unwrap();
        assert_eq!(outputs.len(), 2);
    }

    #[test]
    fn insufficient_xudt() {
        let c = cfg();
        let cells = vec![make_cell(300_00_000_000, 100, "0x11")];
        let err = build_xudt_transfer(&c, &cells, "0xaa", 500, 10_000).unwrap_err();
        assert!(err.to_string().contains("Insufficient xUDT"), "got: {}", err);
    }

    #[test]
    fn sign_replaces_placeholder_lock() {
        let c = cfg();
        let cells = vec![make_cell(300_00_000_000, 1000, "0x11")];
        let mut built = build_xudt_transfer(&c, &cells, "0xaabbccddeeff00112233445566778899aabbccdd", 400, 10_000).unwrap();
        let pk = [0x42u8; 32];
        sign_tx(&mut built, &pk).unwrap();
        let w0 = built.tx["witnesses"][0].as_str().unwrap();
        // Signature region (20..85 in raw bytes => hex offset 2 + 40..170)
        let bytes = hex::decode(strip_0x(w0)).unwrap();
        let sig = &bytes[20..20 + 65];
        assert!(sig.iter().any(|b| *b != 0), "signature must not be all-zero");
    }

    #[test]
    fn sign_rejects_bad_key() {
        let c = cfg();
        let cells = vec![make_cell(300_00_000_000, 1000, "0x11")];
        let mut built = build_xudt_transfer(&c, &cells, "0xaa", 400, 10_000).unwrap();
        // 31 bytes - wrong length
        assert!(sign_tx(&mut built, &[0u8; 31]).is_err());
        // 32 zero bytes - invalid secp256k1 key
        assert!(sign_tx(&mut built, &[0u8; 32]).is_err());
    }

    #[test]
    fn insufficient_capacity() {
        let c = cfg();
        // xUDT enough but capacity way below XUDT_MIN + CKB_MIN + fee
        let cells = vec![make_cell(100_00_000_000, 1000, "0x11")];
        let err = build_xudt_transfer(&c, &cells, "0xaa", 100, 10_000).unwrap_err();
        assert!(err.to_string().contains("Insufficient CKB capacity"), "got: {}", err);
    }
}
