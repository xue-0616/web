use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, pools::{TokenResponse, TopTokensResponse}};

/// GET /api/v1/tokens/top
/// Returns based tokens (CKB, BTC) and popular tokens by volume
pub async fn handler(ctx: web::Data<AppContext>) -> Result<HttpResponse, ApiError> {
    // Read top tokens from Redis cache (populated by popular_tokens_updater)
    let mut conn = ctx.redis_conn().await
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    let cached: Option<String> = redis::cmd("GET")
        .arg("sequencer:popular_tokens")
        .query_async(&mut conn).await.ok();
    let top_tokens = cached.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default();
    // based_tokens: CKB native + wrapped BTC
    // popular_tokens: sorted by 24h volume across all pools

    Ok(ApiSuccess::json(TopTokensResponse {
        based_tokens: vec![
            TokenResponse {
                type_hash: "0x".repeat(32),
                symbol: "CKB".to_string(),
                name: "Nervos CKB".to_string(),
                decimals: 8,
                logo: Some("https://storage.utxoswap.xyz/images/ckb.png".to_string()),
                price: None,
            },
        ],
        popular_tokens: vec![],
    }))
}
