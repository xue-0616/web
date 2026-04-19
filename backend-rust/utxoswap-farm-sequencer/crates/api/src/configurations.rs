use actix_web::HttpResponse;
use api_common::error::ApiSuccess;

pub async fn handler() -> HttpResponse {
    ApiSuccess::json(serde_json::json!({
        "farm_type_code_hash": "0x...",
        "farm_type_hash_type": 1,
    }))
}
