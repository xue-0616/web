use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, pools::{TokenResponse, TokensRequest}};
use entity_crate::tokens;
use sea_orm::*;

/// GET /api/v1/tokens?query=CKB
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<TokensRequest>,
) -> Result<HttpResponse, ApiError> {
    let mut q = tokens::Entity::find();

    if let Some(ref search) = query.query {
        if !search.is_empty() {
            q = q.filter(
                Condition::any()
                    .add(tokens::Column::Symbol.contains(search))
                    .add(tokens::Column::Name.contains(search)),
            );
        }
    }

    let results = q.order_by_asc(tokens::Column::Symbol).all(ctx.db()).await?;

    let tokens: Vec<TokenResponse> = results
        .into_iter()
        .map(|t| TokenResponse {
            type_hash: hex::encode(&t.type_hash),
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
            logo: t.logo,
            price: None, // fetched from Redis cache by tokens_manager::price_oracle
        })
        .collect();

    Ok(ApiSuccess::json(tokens))
}
