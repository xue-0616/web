use actix_web::HttpResponse;
use api_common::error::ApiSuccess;

pub async fn handler() -> HttpResponse {
    ApiSuccess::json(serde_json::json!({
        "status": "ok",
        "service": "utxoswap-farm-sequencer",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
