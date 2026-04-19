use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, PaginatedResponse},
    pools::{GetTransactionsRequest, TransactionResponse},
};
use entity_crate::intents;
use sea_orm::*;

/// GET /api/v1/pools/transactions
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<GetTransactionsRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = query.into_inner();
    let page_no = req.page_no.max(1);
    let page_size = req.page_size.min(100).max(1);

    let mut q = intents::Entity::find()
        .filter(intents::Column::Status.eq(intents::IntentStatus::Completed));

    if let Some(ref x_hash) = req.asset_x_type_hash {
        let bytes = types::utils::hex_to_bytes(x_hash)
            .map_err(|e| ApiError::BadRequest(format!("Invalid assetXTypeHash: {}", e)))?;
        q = q.filter(intents::Column::AssetXTypeHash.eq(bytes));
    }
    if let Some(ref y_hash) = req.asset_y_type_hash {
        let bytes = types::utils::hex_to_bytes(y_hash)
            .map_err(|e| ApiError::BadRequest(format!("Invalid assetYTypeHash: {}", e)))?;
        q = q.filter(intents::Column::AssetYTypeHash.eq(bytes));
    }

    let total = q.clone().count(ctx.db()).await? as u64;

    let results = q
        .order_by_desc(intents::Column::CreatedAt)
        .offset(((page_no - 1) * page_size) as u64)
        .limit(page_size as u64)
        .all(ctx.db())
        .await?;

    let txs: Vec<TransactionResponse> = results
        .into_iter()
        .map(|i| TransactionResponse {
            tx_hash: hex::encode(&i.cell_tx_hash),
            pool_type_hash: hex::encode(&i.pool_type_hash),
            intent_type: format!("{:?}", i.intent_type),
            amount_in: i.amount_in.to_string(),
            amount_out: i.amount_out.to_string(),
            status: format!("{:?}", i.status),
            created_at: i.created_at.to_string(),
        })
        .collect();

    Ok(HttpResponse::Ok().json(PaginatedResponse::new(txs, total, page_no, page_size)))
}
