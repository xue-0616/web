use anyhow::Result;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Maximum price deviation allowed from last cached value (50%)
const MAX_PRICE_DEVIATION: f64 = 0.5;

/// Cache TTL in seconds
const CACHE_TTL_SECS: u64 = 30;

/// HTTP request timeout
const REQUEST_TIMEOUT_SECS: u64 = 5;

/// Cached price entry
///
/// BUG-19: Precision note — prices are stored as f64 for display and fee
/// estimation (15–17 significant decimal digits, sufficient for USD quotes).
/// f64 is still **not suitable** for:
///   - On-chain amount calculations (use integer wei/smallest-unit arithmetic)
///   - Financial accounting or settlement (use `rust_decimal::Decimal`)
///
/// `validate_price_sanity` itself now performs the deviation check in
/// `rust_decimal::Decimal` arithmetic to eliminate floating-point rounding
/// from the boundary comparison.
struct CachedPrice {
    price: f64,
    fetched_at: Instant,
}

pub struct PriceOracle {
    cmc_api_key: String,
    client: reqwest::Client,
    /// In-memory cache: symbol -> CachedPrice
    cache: Mutex<HashMap<String, CachedPrice>>,
}

impl PriceOracle {
    pub fn new(cmc_api_key: &str) -> Self {
        Self {
            cmc_api_key: cmc_api_key.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// Check if a cached price is still valid
    fn get_cached(&self, symbol: &str) -> Option<f64> {
        let cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = cache.get(symbol) {
            if entry.fetched_at.elapsed().as_secs() < CACHE_TTL_SECS {
                return Some(entry.price);
            }
        }
        None
    }

    /// Store price in cache
    fn set_cached(&self, symbol: &str, price: f64) {
        let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        cache.insert(symbol.to_string(), CachedPrice {
            price,
            fetched_at: Instant::now(),
        });
    }

    /// Get last known cached price (even if expired) for sanity checking
    fn get_last_known_price(&self, symbol: &str) -> Option<f64> {
        let cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        cache.get(symbol).map(|e| e.price)
    }

    /// Validate price sanity: reject if differs >50% from last known price.
    ///
    /// The deviation comparison is performed in `rust_decimal::Decimal` so
    /// near-boundary cases are not affected by f64 rounding (BUG-19).
    fn validate_price_sanity(&self, symbol: &str, new_price: f64) -> Result<()> {
        use rust_decimal::Decimal;
        use std::str::FromStr;

        if let Some(last_price) = self.get_last_known_price(symbol) {
            if last_price > 0.0 {
                // Convert via string to preserve as many significant digits as
                // f64 can represent without re-introducing binary rounding.
                let last = Decimal::from_str(&format!("{}", last_price)).unwrap_or(Decimal::ZERO);
                let new_d = Decimal::from_str(&format!("{}", new_price)).unwrap_or(Decimal::ZERO);
                let max_dev = Decimal::from_str(&format!("{}", MAX_PRICE_DEVIATION)).unwrap();
                if last > Decimal::ZERO {
                    let diff = (new_d - last).abs();
                    let deviation = diff / last;
                    if deviation > max_dev {
                        anyhow::bail!(
                            "Price sanity check failed for {}: new={}, last={}, deviation={} (max={})",
                            symbol, new_d, last, deviation, max_dev
                        );
                    }
                }
            }
        }
        Ok(())
    }

    /// Get token price in USD from CoinMarketCap.
    /// Returns error instead of 0.0 if price is unavailable.
    ///
    /// # Precision (BUG-19)
    /// Returns f64 which is adequate for display/estimation but should NOT be used
    /// directly for on-chain amount calculations. Convert to integer wei arithmetic
    /// or `rust_decimal::Decimal` before any financial computation.
    pub async fn get_price(&self, symbol: &str) -> Result<f64> {
        // Check cache first
        if let Some(cached) = self.get_cached(symbol) {
            return Ok(cached);
        }

        let resp: serde_json::Value = self.client
            .get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest")
            .header("X-CMC_PRO_API_KEY", &self.cmc_api_key)
            .query(&[("symbol", symbol), ("convert", "USD")])
            .send().await
            .map_err(|e| anyhow::anyhow!("Price API request failed for {}: {}", symbol, e))?
            .json().await
            .map_err(|e| anyhow::anyhow!("Price API response parse failed for {}: {}", symbol, e))?;

        // FINDING-10: Return error instead of unwrap_or(0.0)
        let price = resp["data"][symbol]["quote"]["USD"]["price"]
            .as_f64()
            .ok_or_else(|| anyhow::anyhow!(
                "Price unavailable for {}: API returned no valid price data",
                symbol
            ))?;

        if price <= 0.0 {
            anyhow::bail!("Invalid price for {}: {:.8} (must be positive)", symbol, price);
        }

        // Sanity check against last known price
        self.validate_price_sanity(symbol, price)?;

        // Update cache
        self.set_cached(symbol, price);

        Ok(price)
    }

    /// Batch price query with proper error handling
    pub async fn get_prices(&self, symbols: &[&str]) -> Result<HashMap<String, f64>> {
        let joined = symbols.join(",");
        let resp: serde_json::Value = self.client
            .get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest")
            .header("X-CMC_PRO_API_KEY", &self.cmc_api_key)
            .query(&[("symbol", joined.as_str()), ("convert", "USD")])
            .send().await
            .map_err(|e| anyhow::anyhow!("Batch price API request failed: {}", e))?
            .json().await
            .map_err(|e| anyhow::anyhow!("Batch price API response parse failed: {}", e))?;

        let mut prices = HashMap::new();
        for sym in symbols {
            let price = resp["data"][sym]["quote"]["USD"]["price"]
                .as_f64()
                .ok_or_else(|| anyhow::anyhow!("Price unavailable for {} in batch query", sym))?;

            if price <= 0.0 {
                anyhow::bail!("Invalid price for {} in batch query: {:.8}", sym, price);
            }

            self.validate_price_sanity(sym, price)?;
            self.set_cached(sym, price);
            prices.insert(sym.to_string(), price);
        }
        Ok(prices)
    }
}
