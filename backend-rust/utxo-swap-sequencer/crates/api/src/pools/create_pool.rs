use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiError, pools::CreatePoolRequest};

/// POST /api/v1/pools/create
pub async fn handler(
    _ctx: web::Data<AppContext>,
    body: web::Json<CreatePoolRequest>,
) -> Result<HttpResponse, ApiError> {
    let _req = body.into_inner();
    // Pool creation flow (TODO — MED-SW-1 stub; the real impl
    // also needs a duplicate-pair check on top of the steps below):
    //   1. Parse CKB transaction, extract pool cell creation params
    //   2. Validate asset pair doesn't exist; initial liquidity
    //      meets minimum
    //   3. Derive pool type hash from asset X / Y type hashes
    //   4. Submit CKB transaction to create pool cell with TypeID
    //   5. Store pool metadata in DB
    tracing::info!("Processing pool creation request (stub)");
    Err(ApiError::NotImplemented(
        "pool creation is not yet wired up".to_string(),
    ))
}
