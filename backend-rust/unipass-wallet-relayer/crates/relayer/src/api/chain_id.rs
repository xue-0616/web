use actix_web::{web, HttpResponse};
use api::context::RelayerContext;

pub async fn handler(ctx: web::Data<RelayerContext>) -> HttpResponse {
    // Return supported chain IDs
    HttpResponse::Ok().json(serde_json::json!({
        "chainIds": [42161, 137, 56, 1]  // Arbitrum, Polygon, BSC, Ethereum
    }))
}
