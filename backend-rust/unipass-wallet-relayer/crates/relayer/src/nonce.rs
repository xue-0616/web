//! NonceManager — sequential nonce allocation for the relayer's
//! own EOA across every chain it signs for.
//!
//! # MED-RL-3 prep (round 12)
//!
//! The real `impl TxBroadcaster` needs a deterministic source of
//! nonces.  The naïve approach (re-query
//! `eth_getTransactionCount` before every send) is too slow and
//! races against our own mempool: a batch of 5 sends in quick
//! succession all see the same "latest" nonce and 4 of them fail
//! with `nonce too low` once the first lands.
//!
//! This module gives the broadcaster an in-process counter keyed
//! on `(chain_id, EOA address)`.  The counter is seeded once from
//! `eth_getTransactionCount` the first time we see a new key,
//! then advanced locally per send.
//!
//! # Failure model
//!
//! The broadcaster MUST call `invalidate()` on any of these
//! signals from the RPC:
//!
//!   * `nonce too low`  — someone else (or a previous run of
//!     ourselves that hadn't flushed its cache) advanced the
//!     on-chain nonce.  We need to re-seed.
//!   * `already known`  — we re-sent the same tx; still
//!     re-seed because our cache is now a round behind.
//!   * Network / RPC timeout on `eth_sendRawTransaction` with
//!     unknown outcome — could have landed or not.  Re-seed.
//!
//! Not invalidating on these causes a cascading queue-jam: every
//! subsequent next_nonce() returns a higher cached value while
//! the chain is stuck at the older one, so every tx fails with
//! the same `nonce too low` and we never recover without a
//! pod restart.
//!
//! # Concurrency
//!
//! A single `Mutex<HashMap>` gates all access.  This is O(1) per
//! call and sufficient for any relayer sending < ~1k tx/s from
//! a single EOA; the EOA itself is the bottleneck there.  If we
//! ever need sharded locks, switch to `DashMap` — the API
//! surface is designed to be a drop-in.

use ethers::types::Address;
use std::collections::HashMap;
use tokio::sync::Mutex;

/// RPC source for the seeded nonce.
///
/// Kept as a trait so the manager's behaviour is unit-testable
/// without an `ethers::Provider` or a live node.  The eventual
/// `EthersNonceProvider` impl will wrap
/// `Middleware::get_transaction_count(addr, BlockNumber::Pending)`.
///
/// NOTE: use `Pending`, not `Latest`.  Using `Latest` races with
/// our own previous tx that might be in the mempool but not yet
/// mined, and we'd hand out a colliding nonce.
#[async_trait::async_trait]
pub trait NonceProvider: Send + Sync {
    async fn onchain_nonce(&self, chain_id: u64, addr: Address) -> anyhow::Result<u64>;
}

/// In-process nonce allocator.
///
/// One instance per relayer process; shared across the consumer
/// tasks via `Arc<NonceManager<_>>`.
pub struct NonceManager<P: NonceProvider> {
    provider: P,
    cache: Mutex<HashMap<(u64, Address), u64>>,
}

impl<P: NonceProvider> NonceManager<P> {
    pub fn new(provider: P) -> Self {
        Self {
            provider,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// Return the next nonce for `(chain_id, addr)` and advance
    /// the local counter.
    ///
    /// On the first call for a given key (or after `invalidate`),
    /// seeds the counter from the RPC.  Subsequent calls increment
    /// without network round-trips.
    ///
    /// CONTRACT: the caller MUST either (a) successfully broadcast
    /// a tx with the returned nonce, OR (b) call `invalidate` and
    /// retry.  Returning a nonce and then dropping it (no
    /// broadcast, no invalidate) leaves a permanent gap in the
    /// sequence; the NEXT tx from this EOA will be stuck in
    /// mempool forever, waiting for the "missing" nonce.
    pub async fn next_nonce(
        &self,
        chain_id: u64,
        addr: Address,
    ) -> anyhow::Result<u64> {
        let mut cache = self.cache.lock().await;
        let key = (chain_id, addr);
        let current = match cache.get(&key) {
            Some(&n) => n,
            None => self.provider.onchain_nonce(chain_id, addr).await?,
        };
        cache.insert(key, current + 1);
        Ok(current)
    }

    /// Drop the cached nonce for `(chain_id, addr)`; the next
    /// `next_nonce` call will re-seed from RPC.
    ///
    /// Call after any RPC error that suggests the cache is out
    /// of sync — see the module doc's "Failure model" section.
    pub async fn invalidate(&self, chain_id: u64, addr: Address) {
        self.cache.lock().await.remove(&(chain_id, addr));
    }

    /// Force the cached nonce to a specific value.
    ///
    /// Used during reorg recovery or after an operator manually
    /// drops a stuck tx.  Prefer `invalidate` in the normal error
    /// path; reach for `set_cached` only when you have a confirmed
    /// on-chain value to snap to.
    pub async fn set_cached(
        &self,
        chain_id: u64,
        addr: Address,
        nonce: u64,
    ) {
        self.cache.lock().await.insert((chain_id, addr), nonce);
    }

    /// Inspect the current cached value without advancing it.
    /// Useful for test assertions and for operator endpoints.
    pub async fn peek(
        &self,
        chain_id: u64,
        addr: Address,
    ) -> Option<u64> {
        self.cache.lock().await.get(&(chain_id, addr)).copied()
    }
}

#[cfg(test)]
mod tests {
    //! The tests here walk the **contract** the real broadcaster
    //! relies on, not the provider impl (which is a no-op wrapper
    //! around ethers' Middleware).  Every test uses a mock
    //! `NonceProvider` that counts its own calls so we can assert
    //! the cache is actually being used (and invalidate() forces
    //! a re-fetch).
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    /// Mock that returns a fixed seed and counts calls.
    struct CountingProvider {
        seed: u64,
        calls: Arc<AtomicU64>,
    }
    #[async_trait::async_trait]
    impl NonceProvider for CountingProvider {
        async fn onchain_nonce(
            &self,
            _chain_id: u64,
            _addr: Address,
        ) -> anyhow::Result<u64> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            Ok(self.seed)
        }
    }

    /// Mock whose response varies per call — used for the
    /// "invalidate re-fetches" test.
    struct ScriptedProvider {
        responses: Mutex<Vec<u64>>,
    }
    #[async_trait::async_trait]
    impl NonceProvider for ScriptedProvider {
        async fn onchain_nonce(
            &self,
            _chain_id: u64,
            _addr: Address,
        ) -> anyhow::Result<u64> {
            Ok(self.responses.lock().await.pop().expect("no scripted value"))
        }
    }

    /// Mock that returns a fixed error — used for the
    /// "error propagation" test.
    struct FailingProvider;
    #[async_trait::async_trait]
    impl NonceProvider for FailingProvider {
        async fn onchain_nonce(
            &self,
            _chain_id: u64,
            _addr: Address,
        ) -> anyhow::Result<u64> {
            anyhow::bail!("rpc unreachable")
        }
    }

    fn addr(last: u8) -> Address {
        let mut a = [0u8; 20];
        a[19] = last;
        Address::from(a)
    }

    #[tokio::test]
    async fn first_call_seeds_from_provider() {
        let calls = Arc::new(AtomicU64::new(0));
        let mgr = NonceManager::new(CountingProvider {
            seed: 42,
            calls: calls.clone(),
        });
        let n = mgr.next_nonce(1, addr(1)).await.unwrap();
        assert_eq!(n, 42);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn second_call_increments_without_refetch() {
        let calls = Arc::new(AtomicU64::new(0));
        let mgr = NonceManager::new(CountingProvider {
            seed: 100,
            calls: calls.clone(),
        });
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 100);
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 101);
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 102);
        // Provider called exactly once — the rest came from cache.
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn invalidate_forces_refetch() {
        // Scripted: first fetch returns 10, second returns 50.
        // After the first invalidate(), the next next_nonce must
        // surface the 50, not stay at 11.
        let mgr = NonceManager::new(ScriptedProvider {
            responses: Mutex::new(vec![50, 10]), // popped in reverse
        });
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 10);
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 11);
        mgr.invalidate(1, addr(1)).await;
        // Re-seed from RPC's new value.
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 50);
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 51);
    }

    #[tokio::test]
    async fn independent_chain_ids_do_not_collide() {
        // Same address, two chains.  Each chain's counter must
        // advance independently — a send on Polygon must not
        // consume an Arbitrum nonce.
        let calls = Arc::new(AtomicU64::new(0));
        let mgr = NonceManager::new(CountingProvider {
            seed: 7,
            calls: calls.clone(),
        });
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 7); // ETH seed
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 8);
        assert_eq!(mgr.next_nonce(137, addr(1)).await.unwrap(), 7); // Polygon seed
        assert_eq!(mgr.next_nonce(137, addr(1)).await.unwrap(), 8);
        // Provider was asked once per chain_id.
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn independent_addresses_do_not_collide() {
        // Two EOAs on the same chain — e.g. a future
        // multi-signer rollout.  Each address gets its own
        // counter.
        let calls = Arc::new(AtomicU64::new(0));
        let mgr = NonceManager::new(CountingProvider {
            seed: 3,
            calls: calls.clone(),
        });
        assert_eq!(mgr.next_nonce(1, addr(0xaa)).await.unwrap(), 3);
        assert_eq!(mgr.next_nonce(1, addr(0xbb)).await.unwrap(), 3);
        assert_eq!(mgr.next_nonce(1, addr(0xaa)).await.unwrap(), 4);
        assert_eq!(mgr.next_nonce(1, addr(0xbb)).await.unwrap(), 4);
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn provider_error_propagates() {
        // If the first-ever fetch fails, next_nonce must bubble
        // the error up so the broadcaster can return Transient.
        // It must NOT cache a fallback value (e.g. 0) — that
        // would cause every subsequent tx to collide.
        let mgr = NonceManager::new(FailingProvider);
        let err = mgr.next_nonce(1, addr(1)).await.unwrap_err();
        assert!(err.to_string().contains("rpc unreachable"));
        // Cache is still empty; retry path is available.
        assert!(mgr.peek(1, addr(1)).await.is_none());
    }

    #[tokio::test]
    async fn set_cached_overrides_existing_value() {
        let calls = Arc::new(AtomicU64::new(0));
        let mgr = NonceManager::new(CountingProvider {
            seed: 10,
            calls: calls.clone(),
        });
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 10);
        mgr.set_cached(1, addr(1), 999).await;
        // set_cached does NOT advance; the next next_nonce returns
        // the set value.
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 999);
        assert_eq!(mgr.next_nonce(1, addr(1)).await.unwrap(), 1000);
    }

    #[tokio::test]
    async fn concurrent_callers_get_unique_nonces() {
        // The load-bearing concurrency invariant: 100 concurrent
        // next_nonce calls from different tasks must return 100
        // distinct values.  If the Mutex is released between the
        // get and the insert, two callers could read the same
        // stale value and both advance to the same next one —
        // causing colliding broadcasts and a mempool stall.
        use std::sync::Arc;
        let mgr = Arc::new(NonceManager::new(CountingProvider {
            seed: 0,
            calls: Arc::new(AtomicU64::new(0)),
        }));

        let mut handles = Vec::new();
        for _ in 0..100 {
            let m = mgr.clone();
            handles.push(tokio::spawn(async move {
                m.next_nonce(1, addr(1)).await.unwrap()
            }));
        }
        let mut seen = Vec::new();
        for h in handles {
            seen.push(h.await.unwrap());
        }
        seen.sort();
        seen.dedup();
        assert_eq!(seen.len(), 100, "expected 100 unique nonces");
        assert_eq!(seen.first().copied(), Some(0));
        assert_eq!(seen.last().copied(), Some(99));
    }

    #[tokio::test]
    async fn peek_does_not_advance() {
        // peek() is for operator endpoints / test assertions;
        // it MUST be side-effect-free.
        let calls = Arc::new(AtomicU64::new(0));
        let mgr = NonceManager::new(CountingProvider {
            seed: 5,
            calls: calls.clone(),
        });
        // peek before any next_nonce: cache empty, None.
        assert!(mgr.peek(1, addr(1)).await.is_none());
        // Seed it.
        mgr.next_nonce(1, addr(1)).await.unwrap(); // returns 5, cache=6
        // peek sees the *next* value the cache would hand out.
        assert_eq!(mgr.peek(1, addr(1)).await, Some(6));
        // Multiple peeks: still 6, provider never re-called.
        assert_eq!(mgr.peek(1, addr(1)).await, Some(6));
        assert_eq!(mgr.peek(1, addr(1)).await, Some(6));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}
