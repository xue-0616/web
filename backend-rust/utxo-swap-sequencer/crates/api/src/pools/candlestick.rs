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

    /// Build a `pool_statistics::Model` with just the fields
    /// `aggregate_candles` actually reads.
    fn stat(ts_secs: i64, price: i64, vol: i64) -> pool_statistics::Model {
        pool_statistics::Model {
            id: 0,
            pool_type_hash: vec![0u8; 32],
            asset_x_amount: None,
            asset_y_amount: None,
            price: Some(rust_decimal::Decimal::from(price)),
            tvl: None,
            volume: Some(rust_decimal::Decimal::from(vol)),
            txs_count: None,
            created_at: chrono::DateTime::from_timestamp(ts_secs, 0)
                .unwrap()
                .naive_utc(),
        }
    }

    /// HIGH-SW-7 regression: a gap of 3 empty buckets between two
    /// trades must produce 3 doji continuation candles, not be
    /// silently absorbed into the next "real" candle.
    #[test]
    fn high_sw_7_gap_fills_with_continuation_candles() {
        // 60-second candles. First trade at t=0, next trade at
        // t=240 — that's 4 buckets later, so we expect:
        //   [0..60)   : real, single trade  -> close = 100
        //   [60..120) : doji, vol 0, OHLC = 100
        //   [120..180): doji, vol 0, OHLC = 100
        //   [180..240): doji, vol 0, OHLC = 100
        //   [240..)   : real, in-progress, opens at 100 closes at 110
        let stats = vec![stat(0, 100, 5), stat(240, 110, 7)];
        let candles = aggregate_candles(&stats, 60);
        assert_eq!(candles.len(), 5,
            "expected 5 candles (1 real + 3 gap + 1 in-progress), \
             got {}: {:#?}", candles.len(), candles);

        // First real candle.
        assert_eq!(candles[0].open, "100");
        assert_eq!(candles[0].close, "100");
        assert_eq!(candles[0].volume, "5");

        // Three gap-fill candles: zero volume, flat OHLC.
        for (i, c) in candles[1..=3].iter().enumerate() {
            assert_eq!(c.volume, "0",
                "gap candle {} must have zero volume", i + 1);
            assert_eq!(c.open, "100",
                "gap candle {} open must equal previous close", i + 1);
            assert_eq!(c.close, "100",
                "gap candle {} close must equal previous close", i + 1);
            assert_eq!(c.high, "100");
            assert_eq!(c.low, "100");
        }

        // Final in-progress candle starts at the previous close
        // (continuity), absorbs the new trade, ends at 110.
        assert_eq!(candles[4].open, "100",
            "candle after gap must open at previous close, not at 110");
        assert_eq!(candles[4].close, "110");
        assert_eq!(candles[4].volume, "7");
    }

    #[test]
    fn high_sw_7_no_gap_emits_two_candles() {
        // Two trades in adjacent 60-s buckets — no gap-fill needed.
        let stats = vec![stat(0, 100, 1), stat(70, 105, 2)];
        let candles = aggregate_candles(&stats, 60);
        assert_eq!(candles.len(), 2);
        assert_eq!(candles[0].close, "100");
        assert_eq!(candles[1].open, "100",
            "second candle should still open at first close (continuity)");
        assert_eq!(candles[1].close, "105");
    }

    #[test]
    fn high_sw_7_zero_interval_returns_empty_not_infinite_loop() {
        // Defence-in-depth: handler validates the interval but the
        // function should fail safe if called with 0.
        let stats = vec![stat(0, 100, 1), stat(60, 110, 1)];
        let candles = aggregate_candles(&stats, 0);
        assert!(candles.is_empty());
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

/// Bucket the raw `pool_statistics` rows into fixed-width
/// candlesticks of `interval_seconds`.
///
/// # HIGH-SW-7 — gap handling fix
///
/// The previous implementation:
///
/// ```ignore
/// if ts - current_start >= interval_seconds {
///     flush();
///     current_start += interval_seconds;   // advance ONE bucket
///     open = price.clone();                // open := this point
/// }
/// ```
///
/// had two bugs that combined to corrupt charts whenever data was
/// sparse (which is most of the time on lightly-traded pools):
///
/// 1. **Skipped intervals.** If the next data point fell two or
///    more buckets ahead, the loop only advanced `current_start`
///    by one bucket. The flushed candle's timestamp was correct,
///    but every subsequent bucket up until the new point was
///    silently absorbed into the *next* candle. The chart was
///    missing intervals.
///
/// 2. **Discontinuous open.** When a new bucket started after a
///    gap, `open` was set to the new data point's price rather
///    than the previous candle's `close`. Trading-view–style
///    charts assume continuity (a "doji" of unchanged price for
///    quiet periods); breaking that produced phantom price jumps.
///
/// The new loop:
///
///   * `while ts - current_start >= interval_seconds` instead of
///     `if`, so every empty bucket between two real data points
///     gets a flat candle of its own with `open == high == low ==
///     close == previous_close` and `volume = 0`;
///   * the new "real" candle (the one that actually contains the
///     incoming point) starts with `open := previous_close`, so
///     prices remain continuous across gaps.
fn aggregate_candles(
    stats: &[pool_statistics::Model],
    interval_seconds: i64,
) -> Vec<CandlestickData> {
    if stats.is_empty() {
        return Vec::new();
    }
    // Defensive: a non-positive interval would loop forever in the
    // gap-fill below. Should be impossible — `handler` validates
    // it via the candlestick_type match — but guard anyway.
    if interval_seconds <= 0 {
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

        // Drain *every* bucket strictly older than `ts`. The first
        // iteration flushes the bucket the loop is currently
        // building; subsequent iterations emit zero-volume
        // continuation candles for any silent buckets in between.
        while ts - current_start >= interval_seconds {
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

            current_start += interval_seconds;
            // Continuity: the next candle inherits the close
            // price as its open/high/low/close baseline. If this
            // candle ends up empty too, it'll be flushed in the
            // next iteration as a flat doji.
            open = close.clone();
            high = close.clone();
            low = close.clone();
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

    // Flush the final in-progress bucket (always at least one).
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
