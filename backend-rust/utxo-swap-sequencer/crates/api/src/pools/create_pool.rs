use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, pools::CreatePoolRequest};

/// POST /api/v1/pools/create
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<CreatePoolRequest>,
) -> Result<HttpResponse, ApiError> {
    let _req = body.into_inner();
    // Pool creation flow:
    // 1. Parse CKB transaction, extract pool cell creation params
    // 2. Validate: pair doesn't exist, initial liquidity meets minimum
    // 3. Derive pool type hash from asset X and asset Y type hashes
    // 4. Submit CKB transaction to create pool cell with TypeID
    // 5. Store pool metadata in DB
    use entity_crate::pools;
    use sea_orm::*;
    tracing::info!("Processing pool creation request");
    //       2. Validate asset pair doesn't exist
    //       3. Submit tx to CKB
    //       4. Create pool record in DB
    Err(ApiError::Internal("Not yet implemented".to_string()))
}
