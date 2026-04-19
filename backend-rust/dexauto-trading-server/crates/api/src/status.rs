use actix_web::HttpResponse;
pub async fn handler() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "dexauto-trading-server",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
