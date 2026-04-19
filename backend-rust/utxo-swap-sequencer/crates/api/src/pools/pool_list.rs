use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, PaginatedResponse},
    pools::{GetPoolsRequest, PoolInfoResponse, TokenAsset},
};
use entity_crate::{pools, tokens};
use sea_orm::*;

/// GET /api/v1/pools?searchKey=&orderBy=tvl&pageNo=1&pageSize=20
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<GetPoolsRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = query.into_inner();
    let page_no = req.page_no.max(1);
    let page_size = req.page_size.min(100).max(1);

    // Build query
    let mut q = pools::Entity::find();

    // Filter by pool type hashes if provided
    if let Some(ref hashes) = req.pool_type_hashes {
        let hash_list: Vec<Vec<u8>> = hashes
            .split(',')
            .filter_map(|h| types::utils::hex_to_bytes(h.trim()).ok())
            .collect();
        if !hash_list.is_empty() {
            q = q.filter(pools::Column::TypeHash.is_in(hash_list));
        }
    }

    // Order by
    q = match req.order_by.as_str() {
        "tvl" => q.order_by_desc(pools::Column::Tvl),
        "dayVolume" => q.order_by_desc(pools::Column::DayVolume),
        "dayApr" => q.order_by_desc(pools::Column::DayApr),
        "totalVolume" => q.order_by_desc(pools::Column::TotalVolume),
        _ => q.order_by_desc(pools::Column::Tvl),
    };

    // Count total
    let total = q.clone().count(ctx.db()).await? as u64;

    // Paginate
    let pools = q
        .offset(((page_no - 1) * page_size) as u64)
        .limit(page_size as u64)
        .all(ctx.db())
        .await?;

    // Enrich with token info
    let mut results = Vec::new();
    for pool in pools {
        let token_x = tokens::Entity::find()
            .filter(tokens::Column::TypeHash.eq(pool.asset_x_type_hash.clone()))
            .one(ctx.db())
            .await?;
        let token_y = tokens::Entity::find()
            .filter(tokens::Column::TypeHash.eq(pool.asset_y_type_hash.clone()))
            .one(ctx.db())
            .await?;

        results.push(PoolInfoResponse {
            id: pool.id,
            pool_type_hash: hex::encode(&pool.type_hash),
            asset_x_type_hash: hex::encode(&pool.asset_x_type_hash),
            asset_y_type_hash: hex::encode(&pool.asset_y_type_hash),
            asset_x: token_to_asset(token_x),
            asset_y: token_to_asset(token_y),
            lp_symbol: pool.lp_symbol,
            fee_rate: "30".to_string(), // default 0.3% (30 bps), overridden by on-chain pool data
            tvl: pool.tvl.map(|v| v.to_string()),
            day_volume: pool.day_volume.map(|v| v.to_string()),
            total_volume: pool.total_volume.map(|v| v.to_string()),
            day_apr: pool.day_apr.map(|v| v.to_string()),
            asset_x_amount: pool.asset_x_amount.map(|v| v.to_string()),
            asset_y_amount: pool.asset_y_amount.map(|v| v.to_string()),
            based_asset: pool.based_asset.map(|v| format!("{:?}", v)),
            day_txs_count: pool.day_txs_count,
            total_txs_count: pool.total_txs_count,
        });
    }

    Ok(HttpResponse::Ok().json(PaginatedResponse::new(results, total, page_no, page_size)))
}

fn token_to_asset(token: Option<tokens::Model>) -> TokenAsset {
    match token {
        Some(t) => TokenAsset {
            type_hash: hex::encode(&t.type_hash),
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
            logo: t.logo,
        },
        None => TokenAsset {
            type_hash: String::new(),
            symbol: "Unknown".to_string(),
            name: "Unknown Token".to_string(),
            decimals: 8,
            logo: None,
        },
    }
}
