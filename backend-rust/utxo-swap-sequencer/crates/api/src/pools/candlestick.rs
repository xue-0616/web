use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
    pools::{CandlestickData, CandlestickRequest},
};
use entity_crate::pool_statistics;
use sea_orm::*;

/// GET /api/v1/pools/candlestick?poolTypeHash=0x...&candlestickType=1h
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<CandlestickRequest>,
) -> Result<HttpResponse, ApiError> {
    let pool_hash = types::utils::hex_to_bytes(&query.pool_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid poolTypeHash: {}", e)))?;

    let interval_seconds: i64 = match query.candlestick_type.as_str() {
        "1h" => 3600,
        "4h" => 14400,
        "1d" => 86400,
        "1w" => 604800,
        _ => return Err(ApiError::BadRequest("Invalid candlestickType".to_string())),
    };

    // Query pool_statistics ordered by time
    let stats = pool_statistics::Entity::find()
        .filter(pool_statistics::Column::PoolTypeHash.eq(pool_hash.clone()))
        .order_by_asc(pool_statistics::Column::CreatedAt)
        .all(ctx.db())
        .await?;

    // Group statistics into candlestick intervals
    let candles: Vec<CandlestickData> = aggregate_candles(&stats, interval_seconds);

    Ok(ApiSuccess::json(candles))
}

fn aggregate_candles(
    stats: &[pool_statistics::Model],
    interval_seconds: i64,
) -> Vec<CandlestickData> {
    if stats.is_empty() {
        return Vec::new();
    }

    let mut candles = Vec::new();
    let mut current_start = stats[0].created_at.and_utc().timestamp();
    let mut open = stats[0].price.clone().unwrap_or_default();
    let mut high = open.clone();
    let mut low = open.clone();
    let mut close = open.clone();
    let mut volume = rust_decimal::Decimal::ZERO;

    for stat in stats {
        let ts = stat.created_at.and_utc().timestamp();
        let price = stat.price.clone().unwrap_or_default();
        let vol = stat.volume.clone().unwrap_or_default();

        if ts - current_start >= interval_seconds {
            // Flush current candle
            candles.push(CandlestickData {
                open: open.to_string(),
                high: high.to_string(),
                low: low.to_string(),
                close: close.to_string(),
                volume: volume.to_string(),
                timestamp: chrono::DateTime::from_timestamp(current_start, 0)
                    .unwrap_or_default()
                    .to_rfc3339(),
            });

            // Start new candle
            current_start += interval_seconds;
            open = price.clone();
            high = price.clone();
            low = price.clone();
            volume = rust_decimal::Decimal::ZERO;
        }

        if price > high {
            high = price.clone();
        }
        if price < low {
            low = price.clone();
        }
        close = price;
        volume += vol;
    }

    // Flush last candle
    candles.push(CandlestickData {
        open: open.to_string(),
        high: high.to_string(),
        low: low.to_string(),
        close: close.to_string(),
        volume: volume.to_string(),
        timestamp: chrono::DateTime::from_timestamp(current_start, 0)
            .unwrap_or_default()
            .to_rfc3339(),
    });

    candles
}
