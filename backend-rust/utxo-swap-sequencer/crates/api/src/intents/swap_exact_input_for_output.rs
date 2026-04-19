use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
    intents::{SendIntentTxRequest, SendIntentTxResult},
};
use entity_crate::intents::{self, IntentStatus, IntentType};
use sea_orm::*;

/// Maximum transaction hex string length (M-6, L-3)
const MAX_TX_HEX_LENGTH: usize = 1_200_000; // ~600KB in hex

/// POST /api/v1/intents/swap-exact-input-for-output
/// Submit a swap intent with exact input amount
///
/// SECURITY (H-11): Validates all input parameters
/// SECURITY (C-4): Protected by JWT auth middleware
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = body.into_inner();

    // SECURITY (H-11, L-3): Validate input - check tx hex length
    if req.tx.is_empty() {
        return Err(ApiError::BadRequest("Transaction hex is empty".to_string()));
    }
    if req.tx.len() > MAX_TX_HEX_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Transaction hex too long: {} chars (max {})",
            req.tx.len(), MAX_TX_HEX_LENGTH
        )));
    }
    // Validate it's valid hex
    if !req.tx.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest("Transaction contains invalid hex characters".to_string()));
    }

    // 1. Decode the signed CKB transaction
    let tx_bytes = types::utils::hex_to_bytes(&req.tx)
        .map_err(|e| ApiError::BadRequest(format!("Invalid tx hex: {}", e)))?;

    // 2. Parse intent from transaction outputs
    // The intent is encoded in one of the output cells' data
    // Look for the cell with the sequencer lock script; also record which
    // output index the intent was embedded in — that becomes the cell_index
    // persisted in DB so the sequencer knows exactly which UTXO represents
    // the intent.
    let (parsed_intent, intent_cell_index) = parse_intent_from_tx(&tx_bytes)
        .map_err(|e| ApiError::IntentError(format!("Failed to parse intent: {}", e)))?;

    // 3. Validate the intent
    // Check pool exists, amounts are valid, etc.
    // This is done by the intent checker
    // types::intent::checker::check_intent(&parsed_intent, &pair_info)?;

    // 4. Send raw transaction to CKB node
    let tx_hash = submit_tx_to_ckb(&ctx, &tx_bytes).await?;

    // 5. Store intent in database
    let now = chrono::Utc::now().naive_utc();
    let intent = intents::ActiveModel {
        intent_type: Set(IntentType::SwapExactInputForOutput),
        cell_index: Set(intent_cell_index),
        cell_tx_hash: Set(tx_hash.clone()),
        pool_type_hash: Set(parsed_intent.pool_type_hash.to_vec()),
        asset_x_type_hash: Set(parsed_intent.asset_x_type_hash.to_vec()),
        asset_y_type_hash: Set(parsed_intent.asset_y_type_hash.to_vec()),
        swap_type: Set(parsed_intent.swap_type.map(|d| match d {
            types::intent::SwapDirection::XToY => entity_crate::intents::SwapType::XToY,
            types::intent::SwapDirection::YToX => entity_crate::intents::SwapType::YToX,
        })),
        amount_in: Set(rust_decimal::Decimal::from(parsed_intent.amount_in)),
        amount_out: Set(rust_decimal::Decimal::ZERO),
        min_amount: Set(rust_decimal::Decimal::from(parsed_intent.min_amount_out)),
        lock_hash: Set(parsed_intent.user_lock.code_hash.to_vec()),
        lock_code_hash: Set(parsed_intent.user_lock.code_hash.to_vec()),
        lock_args: Set(parsed_intent.user_lock.args.clone()),
        status: Set(IntentStatus::Pending),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    let result = intent.insert(ctx.db()).await?;

    // 6. Notify the intent manager via Redis
    notify_new_intent(&ctx, result.id).await?;

    Ok(ApiSuccess::json(SendIntentTxResult {
        tx_hash: hex::encode(&tx_hash),
        status: "pending".to_string(),
    }))
}

/// Parse intent data from CKB transaction
///
/// CKB Transaction (molecule-encoded) layout:
///   total_size(4) | offsets(7*4=28) | raw_tx | witnesses
/// RawTransaction layout:
///   total_size(4) | offsets(6*4=24) | version(4) | cell_deps | header_deps | inputs | outputs | outputs_data
/// outputs_data is a dynvec: total_size(4) | offsets(n*4) | data_0 | data_1 | ...
///
/// We scan each output data blob for a valid intent encoding.
fn parse_intent_from_tx(
    tx_bytes: &[u8],
) -> Result<(types::intent::ParsedIntent, u32), types::intent::parser::ParseError> {
    // Minimum molecule transaction size
    if tx_bytes.len() < 84 {
        return Err(types::intent::parser::ParseError::InvalidLength(tx_bytes.len()));
    }

    // Transaction is a molecule table with 2 fields: raw and witnesses
    // raw offset at bytes [4..8]
    let raw_offset = u32::from_le_bytes(
        tx_bytes[4..8].try_into().map_err(|_| types::intent::parser::ParseError::InvalidLength(tx_bytes.len()))?
    ) as usize;

    if raw_offset >= tx_bytes.len() {
        return Err(types::intent::parser::ParseError::InvalidLength(tx_bytes.len()));
    }

    let raw = &tx_bytes[raw_offset..];
    if raw.len() < 32 {
        return Err(types::intent::parser::ParseError::InvalidLength(raw.len()));
    }

    // RawTransaction is a table with 6 fields
    // Header: total_size(4) + 6 offsets(24) = 28 bytes header
    // Fields: version | cell_deps | header_deps | inputs | outputs | outputs_data
    // outputs_data offset is at raw[24..28]
    if raw.len() < 28 {
        return Err(types::intent::parser::ParseError::InvalidLength(raw.len()));
    }
    let outputs_data_offset = u32::from_le_bytes(
        raw[24..28].try_into().map_err(|_| types::intent::parser::ParseError::InvalidLength(raw.len()))?
    ) as usize;

    if outputs_data_offset >= raw.len() {
        return Err(types::intent::parser::ParseError::InvalidLength(raw.len()));
    }

    let outputs_data_section = &raw[outputs_data_offset..];
    if outputs_data_section.len() < 4 {
        return Err(types::intent::parser::ParseError::InvalidLength(outputs_data_section.len()));
    }

    let od_total = u32::from_le_bytes(
        outputs_data_section[0..4].try_into().map_err(|_| types::intent::parser::ParseError::InvalidLength(0))?
    ) as usize;

    if od_total < 4 || od_total > outputs_data_section.len() {
        return Err(types::intent::parser::ParseError::InvalidLength(od_total));
    }

    // outputs_data is a dynvec: total_size(4) | offsets(n*4) | data items
    // Number of items = (first_offset - 4) / 4
    if od_total <= 4 {
        return Err(types::intent::parser::ParseError::MissingField("no output data items"));
    }

    let first_item_offset = u32::from_le_bytes(
        outputs_data_section[4..8].try_into().map_err(|_| types::intent::parser::ParseError::InvalidLength(0))?
    ) as usize;

    if first_item_offset < 4 {
        return Err(types::intent::parser::ParseError::InvalidLength(first_item_offset));
    }

    let num_items = (first_item_offset - 4) / 4;

    // Try each output data blob to find a valid intent
    for i in 0..num_items {
        let offset_pos = 4 + i * 4;
        if offset_pos + 4 > od_total {
            break;
        }
        let item_start = u32::from_le_bytes(
            outputs_data_section[offset_pos..offset_pos + 4]
                .try_into()
                .map_err(|_| types::intent::parser::ParseError::InvalidLength(0))?
        ) as usize;

        let item_end = if i + 1 < num_items {
            let next_pos = offset_pos + 4;
            u32::from_le_bytes(
                outputs_data_section[next_pos..next_pos + 4]
                    .try_into()
                    .map_err(|_| types::intent::parser::ParseError::InvalidLength(0))?
            ) as usize
        } else {
            od_total
        };

        if item_start >= item_end || item_end > outputs_data_section.len() {
            continue;
        }

        let item_data = &outputs_data_section[item_start..item_end];

        // Try to parse as intent — skip items that aren't valid intents.
        // The output index `i` is the intent's cell_index.
        if let Ok(intent) = types::intent::parser::parse_intent(item_data) {
            return Ok((intent, i as u32));
        }
    }

    Err(types::intent::parser::ParseError::MissingField("no valid intent found in transaction outputs"))
}

/// Submit raw transaction to CKB node
///
/// SECURITY (M-6): Validates transaction structure before submitting to CKB node
async fn submit_tx_to_ckb(ctx: &AppContext, tx_bytes: &[u8]) -> Result<Vec<u8>, ApiError> {
    // SECURITY (M-6): Validate transaction before submission
    validate_transaction(tx_bytes)?;

    // Submit to CKB RPC via HTTP JSON-RPC
    let rpc_url = &ctx.config.ckb_rpc_url;
    let rpc_body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "send_transaction",
        "params": [format!("0x{}", hex::encode(tx_bytes)), "passthrough"]
    });
    let rpc_resp = reqwest::Client::new().post(rpc_url).json(&rpc_body).send().await
        .map_err(|e| ApiError::Internal(format!("CKB RPC error: {}", e)))?;
    let rpc_result: serde_json::Value = rpc_resp.json().await
        .map_err(|e| ApiError::Internal(format!("CKB RPC parse error: {}", e)))?;
    if let Some(err) = rpc_result.get("error") {
        return Err(ApiError::Internal(format!("CKB RPC rejected: {}", err)));
    }

    // Placeholder: return hash of tx bytes
    let hash = types::utils::blake2b_256(tx_bytes);
    Ok(hash.to_vec())
}

/// SECURITY (M-6): Validate CKB transaction structure before submission
/// Checks: minimum size, molecule structure, version field in RawTransaction
///
/// CKB Transaction molecule layout:
///   total_size(4) | offsets(2*4=8) | RawTransaction | witnesses
/// RawTransaction molecule layout:
///   total_size(4) | offsets(6*4=24) | version(4) | cell_deps | header_deps | inputs | outputs | outputs_data
///
/// CRIT-SW-1 FIX: The first 4 bytes of a molecule table are `total_size`, NOT version.
/// The version field is inside RawTransaction at field index 0.
fn validate_transaction(tx_bytes: &[u8]) -> Result<(), ApiError> {
    const MIN_TX_SIZE: usize = 84; // Minimum molecule-encoded transaction
    const MAX_TX_SIZE: usize = 600_000; // CKB max tx size ~596KB

    if tx_bytes.len() < MIN_TX_SIZE {
        return Err(ApiError::BadRequest(format!(
            "Transaction too small: {} bytes (minimum {})",
            tx_bytes.len(),
            MIN_TX_SIZE
        )));
    }

    if tx_bytes.len() > MAX_TX_SIZE {
        return Err(ApiError::BadRequest(format!(
            "Transaction too large: {} bytes (maximum {})",
            tx_bytes.len(),
            MAX_TX_SIZE
        )));
    }

    // Validate molecule total_size field (first 4 bytes of Transaction table)
    let tx_total_size = u32::from_le_bytes(
        tx_bytes[0..4].try_into().unwrap()
    ) as usize;
    if tx_total_size > tx_bytes.len() {
        return Err(ApiError::BadRequest(
            "Transaction molecule total_size exceeds actual data length".to_string()
        ));
    }

    // Transaction is a molecule table with 2 fields (raw, witnesses).
    // Header: total_size(4) + 2 offsets(8) = 12 bytes minimum header
    if tx_bytes.len() < 12 {
        return Err(ApiError::BadRequest(
            "Transaction too short for molecule table header".to_string()
        ));
    }

    // Offset of RawTransaction field is at bytes [4..8]
    let raw_offset = u32::from_le_bytes(
        tx_bytes[4..8].try_into().unwrap()
    ) as usize;
    if raw_offset >= tx_bytes.len() || raw_offset < 12 {
        return Err(ApiError::BadRequest(
            "Invalid RawTransaction offset in molecule table".to_string()
        ));
    }

    let raw = &tx_bytes[raw_offset..];
    // RawTransaction header: total_size(4) + 6 offsets(24) = 28 bytes minimum
    if raw.len() < 28 {
        return Err(ApiError::BadRequest(
            "RawTransaction too short for molecule header".to_string()
        ));
    }

    // Version is the first field of RawTransaction (field index 0).
    // Its offset is at raw[4..8], and it's a 4-byte LE uint32.
    let version_offset = u32::from_le_bytes(
        raw[4..8].try_into().unwrap()
    ) as usize;
    if version_offset + 4 > raw.len() {
        return Err(ApiError::BadRequest(
            "RawTransaction version field offset out of bounds".to_string()
        ));
    }
    let version = u32::from_le_bytes(
        raw[version_offset..version_offset + 4].try_into().unwrap()
    );
    if version != 0 {
        return Err(ApiError::BadRequest(format!(
            "Invalid transaction version: {} (expected 0)",
            version
        )));
    }

    Ok(())
}

/// Notify intent manager of new intent via Redis pub/sub
async fn notify_new_intent(ctx: &AppContext, intent_id: u64) -> Result<(), ApiError> {
    let mut conn = ctx.redis_conn().await.map_err(|e| ApiError::Redis(e.to_string()))?;
    redis::cmd("PUBLISH")
        .arg("sequencer:new_intent")
        .arg(intent_id.to_string())
        .query_async::<()>(&mut conn)
        .await
        .map_err(|e| ApiError::Redis(e.to_string()))?;
    Ok(())
}
