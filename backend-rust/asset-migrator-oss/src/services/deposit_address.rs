//! Deposit address allocator service.
//!
//! Responsibilities:
//!   1. Periodically check each chain's unbound-address count against
//!      `address_batch_threshold`.
//!   2. When below threshold, call the custody wallet API to allocate a
//!      fresh batch, insert them as `status='unbound'` into `deposit_address`.
//!   3. Bind an unbound address to a wallet on demand (via the HTTP API).
//!
//! This file carries the orchestration; the trait-based custody wallet
//! client in [`super::custody_wallet`] handles the external HTTP.

use std::sync::Arc;

use crate::{
    config::InboundChainInfo,
    daos::deposit_address as dao,
    error::{Error, Result},
    services::custody_wallet::{AllocateAddressesRequest, CustodyWalletClient},
};
use sqlx::MySqlPool;

pub struct DepositAddressService {
    pub pool: MySqlPool,
    pub custody: Arc<dyn CustodyWalletClient>,
    pub address_batch_threshold: u32,
}

impl DepositAddressService {
    /// If the unbound pool for `chain` is below `address_batch_threshold`,
    /// request a fresh batch from the custody wallet and insert them as
    /// `status='unbound'`.
    ///
    /// Returns the number of addresses that were actually inserted (0 if
    /// no action was required).
    pub async fn ensure_pool_stocked(&self, chain: &InboundChainInfo) -> Result<u32> {
        let have = dao::count_unbound(&self.pool, &chain.chain_name).await?;
        let threshold = self.address_batch_threshold as i64;
        if have >= threshold {
            return Ok(0);
        }
        let needed = (threshold - have).max(0) as u32;
        let batch = self
            .custody
            .allocate_addresses(&AllocateAddressesRequest {
                chain_name: chain.chain_name.clone(),
                count: needed,
            })
            .await?;

        let now = chrono::Utc::now().naive_utc();
        let mut inserted = 0u32;
        for addr in &batch {
            let r = sqlx::query(
                r#"INSERT IGNORE INTO `deposit_address`
                    (chain_name, address, status, created_time, updated_time)
                   VALUES (?, ?, 'unbound', ?, ?)"#,
            )
            .bind(&addr.chain_name)
            .bind(&addr.address)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
            .await?;
            if r.rows_affected() == 1 {
                inserted += 1;
            }
        }
        Ok(inserted)
    }

    /// Bind an unbound address to `wallet_address` on `chain_name`.
    /// Fails with `NotFound` if the pool is exhausted.
    pub async fn bind_wallet(
        &self,
        chain_name: &str,
        wallet_address: [u8; 20],
    ) -> Result<String> {
        match dao::bind_one(&self.pool, chain_name, &wallet_address).await? {
            Some(row) => Ok(row.address),
            None => Err(Error::NotFound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::custody_wallet::{AllocatedAddress, CustodyWalletClient};
    use async_trait::async_trait;

    struct FakeCustody {
        // Each call to `allocate_addresses` returns this list once.
        next_batch: std::sync::Mutex<Vec<AllocatedAddress>>,
    }

    #[async_trait]
    impl CustodyWalletClient for FakeCustody {
        async fn allocate_addresses(
            &self,
            _req: &AllocateAddressesRequest,
        ) -> Result<Vec<AllocatedAddress>> {
            Ok(std::mem::take(&mut *self.next_batch.lock().unwrap()))
        }
        async fn submit_signed_tx(&self, _c: &str, _r: &str) -> Result<String> {
            Ok("0xcafebabe".into())
        }
    }

    #[tokio::test]
    async fn fake_custody_returns_preset_batch() {
        let fc = FakeCustody {
            next_batch: std::sync::Mutex::new(vec![AllocatedAddress {
                chain_name: "eth".into(),
                address: "0xabc".into(),
            }]),
        };
        let out = fc
            .allocate_addresses(&AllocateAddressesRequest {
                chain_name: "eth".into(),
                count: 1,
            })
            .await
            .unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].address, "0xabc");
    }
}
