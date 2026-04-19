use actix_web::HttpResponse;
/// GET /api/v1/submitters — list relayer submitter addresses per chain
pub async fn handler() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "submitters": {
            "42161": "0x...",
            "137": "0x...",
            "56": "0x...",
        }
    }))
}
