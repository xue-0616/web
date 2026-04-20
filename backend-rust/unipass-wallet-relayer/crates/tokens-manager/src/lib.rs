//! Token price manager — fetches token prices for fee calculation.
//!
//! MED-RL-2: the previous `refresh()` actually made the CoinGecko
//! HTTP call and deserialised the JSON, but then *only logged it*
//! — the `self.prices` HashMap was never populated. Callers of
//! `get_price()` therefore always got `None` back, and the fee
//! estimator's "charge the user in their chosen token" branch
//! silently degraded to "charge native gas only". The fix below
//! keeps the same network call and parses the response into the
//! internal map.
//!
//! Key choice: CoinGecko keys its response by the lower-case coin
//! "id" string (`ethereum`, `usd-coin`, `tether`…), NOT by the
//! on-chain token address. We therefore key the internal HashMap
//! by that same id, and callers must translate token addresses to
//! ids via `coingecko_id_for()` before calling `get_price`. The
//! alternative (keying by address) would need a second lookup
//! table that doesn't exist here; doing it by id keeps the
//! contract simple and obvious at the call site.

use std::collections::HashMap;

pub struct TokensManager {
    /// `coingecko_id -> usd price`.
    prices: HashMap<String, f64>,
}

impl Default for TokensManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TokensManager {
    pub fn new() -> Self {
        Self {
            prices: HashMap::new(),
        }
    }

    /// Look up a USD price for a CoinGecko id (e.g. `"ethereum"`).
    /// Returns `None` if the id was never fetched or the last
    /// refresh returned a non-positive / non-finite price for it.
    pub fn get_price(&self, coingecko_id: &str) -> Option<f64> {
        self.prices.get(coingecko_id).copied()
    }

    /// Maps a handful of well-known ERC-20 token addresses on
    /// mainnet to their CoinGecko ids. Anything not in this list
    /// returns `None` and `get_price` will also return `None` for
    /// it, which the fee estimator already handles as "fall back
    /// to native gas pricing".
    ///
    /// Address comparison is case-insensitive to tolerate the
    /// EIP-55 checksum form the wallet UX produces.
    pub fn coingecko_id_for(token_address: &str) -> Option<&'static str> {
        let addr = token_address.trim().trim_start_matches("0x").to_ascii_lowercase();
        // Limited, deliberately-short allow-list. Expand in the
        // same PR that expands `refresh()`'s `ids` query string,
        // never one without the other.
        match addr.as_str() {
            // USDC (Ethereum mainnet)
            "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" => Some("usd-coin"),
            // USDT (Ethereum mainnet)
            "dac17f958d2ee523a2206206994597c13d831ec7" => Some("tether"),
            // ETH is native, but callers still ask for its USD
            // price via address; map WETH to `ethereum`.
            "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" => Some("ethereum"),
            _ => None,
        }
    }

    /// Refresh prices from CoinGecko. The call populates
    /// `self.prices` for exactly the ids requested below; any id
    /// missing from the response stays at whatever value it had
    /// before this call (or `None` if it was never fetched).
    ///
    /// On an HTTP / JSON failure the existing price map is left
    /// untouched rather than emptied, so a transient CoinGecko
    /// outage doesn't suddenly make every fee estimate fall back
    /// to "no token price known".
    pub async fn refresh(&mut self) -> anyhow::Result<()> {
        const IDS: &str = "ethereum,usd-coin,tether";

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        let resp = client
            .get("https://api.coingecko.com/api/v3/simple/price")
            .query(&[("ids", IDS), ("vs_currencies", "usd")])
            .send()
            .await?;

        if !resp.status().is_success() {
            tracing::warn!(
                "CoinGecko refresh: non-success HTTP {} — keeping previous {} cached prices",
                resp.status(),
                self.prices.len()
            );
            anyhow::bail!("CoinGecko returned {}", resp.status());
        }

        // Response shape: {"ethereum":{"usd":3421.5}, …}
        let body: serde_json::Value = resp.json().await?;
        let obj = body
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("CoinGecko response is not a JSON object"))?;

        let mut ingested = 0usize;
        for id in IDS.split(',') {
            if let Some(price) = obj
                .get(id)
                .and_then(|v| v.get("usd"))
                .and_then(|p| p.as_f64())
                .filter(|p| p.is_finite() && *p > 0.0)
            {
                self.prices.insert(id.to_string(), price);
                ingested += 1;
            } else {
                tracing::warn!("CoinGecko refresh: missing or invalid price for id={}", id);
            }
        }

        tracing::info!(
            "Token prices updated: {} / {} ids ingested, cache now has {} entries",
            ingested,
            IDS.split(',').count(),
            self.prices.len()
        );
        Ok(())
    }

    /// Test-only hook to seed prices without hitting the network.
    /// Kept behind `#[cfg(any(test, feature = "test-hooks"))]` so
    /// production builds can never accidentally poison the cache
    /// with an attacker-controlled value.
    #[cfg(any(test, feature = "test-hooks"))]
    pub fn set_price_for_test(&mut self, id: &str, usd: f64) {
        self.prices.insert(id.to_string(), usd);
    }
}

#[cfg(test)]
mod tests {
    //! MED-RL-2 unit tests. The network-hitting `refresh()` itself
    //! is not a unit test concern — we instead gate:
    //!
    //!   * `get_price` returning what `set_price_for_test` stored;
    //!   * the CoinGecko-id lookup being case-insensitive;
    //!   * `new()` starting with an empty map.
    use super::*;

    #[test]
    fn get_price_returns_stored_value() {
        let mut m = TokensManager::new();
        assert_eq!(m.get_price("ethereum"), None);
        m.set_price_for_test("ethereum", 3_500.0);
        assert_eq!(m.get_price("ethereum"), Some(3_500.0));
    }

    #[test]
    fn coingecko_id_for_is_case_insensitive_and_handles_0x_prefix() {
        // Checksum case + 0x prefix.
        assert_eq!(
            TokensManager::coingecko_id_for("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
            Some("usd-coin")
        );
        // All-lower, no prefix.
        assert_eq!(
            TokensManager::coingecko_id_for("dac17f958d2ee523a2206206994597c13d831ec7"),
            Some("tether")
        );
        // Unknown address → None, not a panic.
        assert_eq!(
            TokensManager::coingecko_id_for("0x0000000000000000000000000000000000000000"),
            None
        );
    }

    #[test]
    fn new_starts_empty() {
        let m = TokensManager::new();
        for id in ["ethereum", "tether", "usd-coin"] {
            assert_eq!(m.get_price(id), None,
                "{} should be None before any refresh/seed", id);
        }
    }
}
