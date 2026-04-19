use actix_web::HttpResponse;
/// GET /api/v1/config
pub async fn handler() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "supportedChains": [42161, 137, 56],
        "feeTokens": ["ETH", "USDC", "USDT"],
    }))
}
