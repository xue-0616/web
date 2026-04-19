use actix_web::{web, HttpResponse};

/// GET /api/v1/status — health/status check.
/// This endpoint does NOT require API key authentication (used for load balancer health checks).
pub async fn handler(ctx: web::Data<api::ValidatorContext>) -> HttpResponse {
    let validator_address = format!("{:?}", ctx.signer.address());
    let supported_chains = ctx.config.supported_chain_ids();

    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "validator_address": validator_address,
        "supported_chains": supported_chains,
        "threshold": ctx.config.threshold,
    }))
}
