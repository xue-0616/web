//! Nonce-replay cache for meta-transaction relaying.
//!
//! **BUG-P2-C2** fix (part 2): even with a valid signature, the same
//! (wallet, nonce) tuple must only be relayed *once*. Without this, an
//! attacker who observes a user's submitted meta-tx from the mempool or
//! Redis queue can re-submit the exact same payload through our HTTP
//! endpoint and force the relayer to broadcast it a second time. The
//! wallet contract will revert the duplicate on-chain (nonce already
//! consumed), but the relayer will have paid the gas.
//!
//! We front the broadcast pipeline with a fast Redis `SETNX` keyed on
//! `(chainId, wallet, nonce)`. First-write-wins: if the key already
//! exists, we return [`ReplayError::AlreadySeen`] and refuse.
//!
//! The key has an expiry (`REPLAY_TTL`) so stale nonces age out; we
//! only need coverage for the window between "accepted by relayer" and
//! "included in a block". One hour is wildly conservative.
//!
//! Tests use [`InMemoryReplayCache`] to exercise the logic without a
//! live Redis.

use async_trait::async_trait;
use deadpool_redis::redis::AsyncCommands;
use ethers::types::{Address, U256};

pub const REPLAY_TTL_SECS: u64 = 3600;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ReplayError {
    #[error("nonce already seen for this wallet; replay rejected")]
    AlreadySeen,
    #[error("replay cache backend unavailable: {0}")]
    Backend(String),
}

#[async_trait]
pub trait ReplayCache: Send + Sync {
    /// Atomically claim `(chain_id, wallet, nonce)`. Returns `Ok(())`
    /// on first claim and [`ReplayError::AlreadySeen`] on every
    /// subsequent attempt within `REPLAY_TTL`.
    async fn claim(
        &self,
        chain_id: u64,
        wallet: Address,
        nonce: U256,
    ) -> Result<(), ReplayError>;
}

fn redis_key(chain_id: u64, wallet: Address, nonce: U256) -> String {
    // Lower-case the address so we don't treat checksum'd vs. lower-case
    // strings as different wallets. Nonce as decimal is fine — U256 ≤
    // 77 decimal digits.
    format!("relayer:nonce:{}:{:?}:{}", chain_id, wallet, nonce)
}

/// Redis-backed implementation: `SET key 1 NX EX REPLAY_TTL`.
pub struct RedisReplayCache {
    pool: deadpool_redis::Pool,
}

impl RedisReplayCache {
    pub fn new(pool: deadpool_redis::Pool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ReplayCache for RedisReplayCache {
    async fn claim(
        &self,
        chain_id: u64,
        wallet: Address,
        nonce: U256,
    ) -> Result<(), ReplayError> {
        let mut conn = self
            .pool
            .get()
            .await
            .map_err(|e| ReplayError::Backend(e.to_string()))?;
        let key = redis_key(chain_id, wallet, nonce);

        // SET key 1 NX EX <ttl>. `set_options` with `NX` returns nil
        // when the key already exists, which deadpool-redis exposes as
        // `Option<String>`.
        use deadpool_redis::redis::{ExistenceCheck, SetExpiry, SetOptions};
        let opts = SetOptions::default()
            .conditional_set(ExistenceCheck::NX)
            .with_expiration(SetExpiry::EX(REPLAY_TTL_SECS));
        let outcome: Option<String> = conn
            .set_options(&key, 1u8, opts)
            .await
            .map_err(|e| ReplayError::Backend(e.to_string()))?;

        match outcome {
            Some(_) => Ok(()),
            None => Err(ReplayError::AlreadySeen),
        }
    }
}

/// In-memory cache for tests. Not suitable for production: restarts
/// of the relayer wipe state, opening a replay window.
#[cfg(any(test, feature = "test-support"))]
pub struct InMemoryReplayCache {
    inner: tokio::sync::Mutex<std::collections::HashSet<String>>,
}

#[cfg(any(test, feature = "test-support"))]
impl InMemoryReplayCache {
    pub fn new() -> Self {
        Self {
            inner: tokio::sync::Mutex::new(std::collections::HashSet::new()),
        }
    }
}

#[cfg(any(test, feature = "test-support"))]
impl Default for InMemoryReplayCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(any(test, feature = "test-support"))]
#[async_trait]
impl ReplayCache for InMemoryReplayCache {
    async fn claim(
        &self,
        chain_id: u64,
        wallet: Address,
        nonce: U256,
    ) -> Result<(), ReplayError> {
        let mut guard = self.inner.lock().await;
        let key = redis_key(chain_id, wallet, nonce);
        if guard.insert(key) {
            Ok(())
        } else {
            Err(ReplayError::AlreadySeen)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn first_claim_succeeds() {
        let cache = InMemoryReplayCache::new();
        assert_eq!(
            cache.claim(1, Address::zero(), U256::from(7)).await,
            Ok(())
        );
    }

    #[tokio::test]
    async fn second_claim_rejected() {
        let cache = InMemoryReplayCache::new();
        cache.claim(1, Address::zero(), U256::from(7)).await.unwrap();
        assert_eq!(
            cache.claim(1, Address::zero(), U256::from(7)).await,
            Err(ReplayError::AlreadySeen),
        );
    }

    #[tokio::test]
    async fn different_nonce_accepted() {
        let cache = InMemoryReplayCache::new();
        cache.claim(1, Address::zero(), U256::from(7)).await.unwrap();
        assert_eq!(
            cache.claim(1, Address::zero(), U256::from(8)).await,
            Ok(()),
        );
    }

    #[tokio::test]
    async fn different_wallet_accepted() {
        let cache = InMemoryReplayCache::new();
        cache.claim(1, Address::zero(), U256::from(7)).await.unwrap();
        let other: Address = "0x00000000000000000000000000000000deadbeef".parse().unwrap();
        assert_eq!(cache.claim(1, other, U256::from(7)).await, Ok(()));
    }

    #[tokio::test]
    async fn different_chain_accepted() {
        let cache = InMemoryReplayCache::new();
        cache.claim(1, Address::zero(), U256::from(7)).await.unwrap();
        assert_eq!(
            cache.claim(42161, Address::zero(), U256::from(7)).await,
            Ok(()),
        );
    }
}
