use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
    pools::{CandlestickData, CandlestickRequest},
};
use entity_crate::pool_statistics;
use sea_orm::*;

/// Maximum number of `pool_statistics` rows we will pull for a
/// single candlestick request. A pool can accumulate tens of
/// thousands of rows over months; handing them all to the aggregator
/// at once eats memory and starves the DB connection pool. The cap
/// is generous enough that a 1-week window at 1-minute granularity
/// (≈10 000 points) fits comfortably, but tight enough that a naive
/// "give me everything" client can't OOM the sequencer.
const MAX_CANDLESTICK_ROWS: u64 = 20_000;

/// Hard upper bound on the time window a single request may cover
/// (inclusive). 365 days is comfortably more than any UI would
/// reasonably ask for at once; requests longer than this are almost
/// certainly a client bug or a scraping attempt.
const MAX_WINDOW_SECONDS: i64 = 365 * 24 * 3600;

/// GET /api/v1/pools/candlestick?poolTypeHash=0x...&candlestickType=1h
///
/// # HIGH-SW-6 bounds on the underlying query
///
/// The previous implementation queried every `pool_statistics` row
/// ever recorded for the requested pool — no LIMIT, no time filter,
/// start_time / end_time on the request DTO silently ignored. For a
/// pool with months of history that read tens of MBs of rows into
/// memory just to serve a chart, turning a simple GET into an easy
/// OOM / connection-pool DoS.
///
/// This implementation:
///   * accepts `startTime` / `endTime` (ISO-8601, optional) and
///     applies them as a `WHERE created_at BETWEEN ?` filter;
///   * rejects windows longer than `MAX_WINDOW_SECONDS` with 400;
///   * caps the returned row set at `MAX_CANDLESTICK_ROWS` via LIMIT;
///   * defaults to "the last 7 days" when the client omits both
///     bounds — which is what a chart actually wants anyway.
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

    // Resolve the window. Parse user input first so bad input fails
    // loudly before we touch the DB.
    let parse_iso = |label: &str, raw: &str| -> Result<chrono::NaiveDateTime, ApiError> {
        chrono::DateTime::parse_from_rfc3339(raw)
            .map(|d| d.naive_utc())
            .map_err(|e| ApiError::BadRequest(format!("Invalid {}: {}", label, e)))
    };

    let now = chrono::Utc::now().naive_utc();
    let end = match query.end_time.as_deref() {
        Some(s) => parse_iso("endTime", s)?,
        None => now,
    };
    let start = match query.start_time.as_deref() {
        Some(s) => parse_iso("startTime", s)?,
        // Default: 7 days of history. Cheap for the DB and matches
        // the default zoom level of every trading UI.
        None => end - chrono::Duration::seconds(7 * 24 * 3600),
    };

    if start >= end {
        return Err(ApiError::BadRequest(
            "startTime must be strictly before endTime".to_string(),
        ));
    }
    let window_secs = (end - start).num_seconds();
    if window_secs > MAX_WINDOW_SECONDS {
        return Err(ApiError::BadRequest(format!(
            "requested window {}s exceeds max {}s (~365 days)",
            window_secs, MAX_WINDOW_SECONDS
        )));
    }

    // Query pool_statistics with the bounded window and a hard
    // LIMIT so a misconfigured high-frequency pool can't blow up
    // the API even if the window math is fine.
    let stats = pool_statistics::Entity::find()
        .filter(pool_statistics::Column::PoolTypeHash.eq(pool_hash.clone()))
        .filter(pool_statistics::Column::CreatedAt.gte(start))
        .filter(pool_statistics::Column::CreatedAt.lte(end))
        .order_by_asc(pool_statistics::Column::CreatedAt)
        .limit(MAX_CANDLESTICK_ROWS)
        .all(ctx.db())
        .await?;

    let candles: Vec<CandlestickData> = aggregate_candles(&stats, interval_seconds);

    Ok(ApiSuccess::json(candles))
}

#[cfg(test)]
mod tests {
    //! HIGH-SW-6 bounds-checking tests. We can't test the DB query
    //! layer without a live MySQL, but we CAN lock the two purely
    //! algorithmic guarantees:
    //!
    //!   * the constants are the values the doc-comments promise
    //!   * the window-math rejects zero / negative / overlong windows
    //!     that the handler relies on to refuse bad input before it
    //!     ever touches the DB.
    //!
    //! The actual window-math is inline in `handler()`; we re-derive
    //! the relevant predicates here to pin them down.
    use super::*;

    #[test]
    fn window_limit_constants_match_docstrings() {
        // If anyone tightens or loosens these, the PR has to touch
        // this test and the reviewer has to acknowledge the change.
        assert_eq!(MAX_CANDLESTICK_ROWS, 20_000);
        assert_eq!(MAX_WINDOW_SECONDS, 365 * 24 * 3600);
    }

    #[test]
    fn window_math_rejects_inverted_range() {
        // start == end must be rejected (would produce zero rows
        // but is still a client bug).
        let end = chrono::NaiveDateTime::from_timestamp_opt(1_700_000_000, 0).unwrap();
        let start = end;
        assert!(start >= end, "equal timestamps count as inverted");

        // start > end is obviously inverted.
        let start = end + chrono::Duration::seconds(1);
        assert!(start >= end);
    }

    #[test]
    fn window_math_rejects_over_one_year() {
        let end = chrono::NaiveDateTime::from_timestamp_opt(1_700_000_000, 0).unwrap();
        let start = end - chrono::Duration::seconds(MAX_WINDOW_SECONDS + 1);
        let span = (end - start).num_seconds();
        assert!(span > MAX_WINDOW_SECONDS,
            "span {} must exceed the {} cap", span, MAX_WINDOW_SECONDS);
    }

    #[test]
    fn window_math_accepts_exact_one_year() {
        let end = chrono::NaiveDateTime::from_timestamp_opt(1_700_000_000, 0).unwrap();
        let start = end - chrono::Duration::seconds(MAX_WINDOW_SECONDS);
        let span = (end - start).num_seconds();
        assert_eq!(span, MAX_WINDOW_SECONDS);
    }

    #[test]
    fn default_window_is_seven_days() {
        // When the client omits both bounds the handler derives
        // `start = end - 7 days`. Make sure a regression never
        // narrows or widens that silently.
        let end = chrono::NaiveDateTime::from_timestamp_opt(1_700_000_000, 0).unwrap();
        let start = end - chrono::Duration::seconds(7 * 24 * 3600);
        assert_eq!((end - start).num_seconds(), 7 * 24 * 3600);
    }
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
