//! DAO abstraction.
//!
//! The closed-source ELF uses `redb` (256 symbols). We hide redb behind
//! [`Dao`] so (a) RPC is fully unit-testable without any storage crate
//! and (b) any embedded KV — sled, fjall, rocksdb — can be plugged in.

use std::collections::BTreeMap;
use std::sync::RwLock;

use async_trait::async_trait;

use crate::{
    error::{Error, Result},
    types::{
        AccountBalance, OutPoint, RgbppEvent, TokenHolder, TokenInfo, TokenOutPoint,
    },
};

/// Data-access interface. All methods are async to accommodate redb's
/// blocking I/O being shimmed through `tokio::task::spawn_blocking`.
#[async_trait]
pub trait Dao: Send + Sync + 'static {
    async fn tip_block_ckb(&self) -> Result<Option<u64>>;
    async fn tip_block_btc(&self) -> Result<Option<u64>>;

    async fn balances_for(&self, account: &str, tokens: &[String]) -> Result<Vec<AccountBalance>>;
    async fn holders_for(&self, token: &str) -> Result<Vec<TokenHolder>>;
    async fn tokens(&self, filter: &[String]) -> Result<Vec<TokenInfo>>;
    async fn outpoints_for(
        &self,
        account: &str,
        chain: crate::types::Chain,
    ) -> Result<Vec<TokenOutPoint>>;
    async fn event_by_input(&self, tx_hash: &str, index: u32) -> Result<Option<RgbppEvent>>;
    async fn event_by_output(&self, tx_hash: &str, index: u32) -> Result<Option<RgbppEvent>>;
}

// ────────────────────────────────────────────────────────────────────
// MemoryDao — in-process, used by tests + as the reference impl for
// the RPC layer integration tests.
// ────────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct MemoryDao {
    inner: RwLock<MemoryInner>,
}

#[derive(Default)]
struct MemoryInner {
    tip_ckb: Option<u64>,
    tip_btc: Option<u64>,
    balances: Vec<AccountBalance>,
    holders_by_token: BTreeMap<String, Vec<TokenHolder>>,
    tokens: BTreeMap<String, TokenInfo>,
    outpoints_by_account_ckb: BTreeMap<String, Vec<TokenOutPoint>>,
    outpoints_by_account_btc: BTreeMap<String, Vec<TokenOutPoint>>,
    event_by_input: BTreeMap<(String, u32), RgbppEvent>,
    event_by_output: BTreeMap<(String, u32), RgbppEvent>,
}

impl MemoryDao {
    pub fn new() -> Self { Self::default() }

    pub fn set_tip(&self, ckb: Option<u64>, btc: Option<u64>) {
        let mut g = self.inner.write().unwrap();
        g.tip_ckb = ckb;
        g.tip_btc = btc;
    }
    pub fn insert_balance(&self, b: AccountBalance) {
        self.inner.write().unwrap().balances.push(b);
    }
    pub fn insert_holder(&self, h: TokenHolder) {
        self.inner.write().unwrap()
            .holders_by_token
            .entry(h.token.clone())
            .or_default()
            .push(h);
    }
    pub fn insert_token(&self, t: TokenInfo) {
        self.inner.write().unwrap().tokens.insert(t.token.clone(), t);
    }
    pub fn insert_outpoint(&self, account: &str, chain: crate::types::Chain, op: TokenOutPoint) {
        let mut g = self.inner.write().unwrap();
        let map = match chain {
            crate::types::Chain::Ckb => &mut g.outpoints_by_account_ckb,
            crate::types::Chain::Btc => &mut g.outpoints_by_account_btc,
        };
        map.entry(account.to_string()).or_default().push(op);
    }
    pub fn insert_event_by_input(&self, tx: &str, idx: u32, e: RgbppEvent) {
        self.inner.write().unwrap().event_by_input.insert((tx.into(), idx), e);
    }
    pub fn insert_event_by_output(&self, tx: &str, idx: u32, e: RgbppEvent) {
        self.inner.write().unwrap().event_by_output.insert((tx.into(), idx), e);
    }
}

#[async_trait]
impl Dao for MemoryDao {
    async fn tip_block_ckb(&self) -> Result<Option<u64>> { Ok(self.inner.read().unwrap().tip_ckb) }
    async fn tip_block_btc(&self) -> Result<Option<u64>> { Ok(self.inner.read().unwrap().tip_btc) }

    async fn balances_for(&self, account: &str, tokens: &[String]) -> Result<Vec<AccountBalance>> {
        let g = self.inner.read().unwrap();
        Ok(g.balances.iter()
            .filter(|b| b.account == account && (tokens.is_empty() || tokens.iter().any(|t| t == &b.token)))
            .cloned()
            .collect())
    }

    async fn holders_for(&self, token: &str) -> Result<Vec<TokenHolder>> {
        let g = self.inner.read().unwrap();
        Ok(g.holders_by_token.get(token).cloned().unwrap_or_default())
    }

    async fn tokens(&self, filter: &[String]) -> Result<Vec<TokenInfo>> {
        let g = self.inner.read().unwrap();
        if filter.is_empty() {
            Ok(g.tokens.values().cloned().collect())
        } else {
            Ok(filter.iter().filter_map(|t| g.tokens.get(t).cloned()).collect())
        }
    }

    async fn outpoints_for(
        &self,
        account: &str,
        chain: crate::types::Chain,
    ) -> Result<Vec<TokenOutPoint>> {
        let g = self.inner.read().unwrap();
        let map = match chain {
            crate::types::Chain::Ckb => &g.outpoints_by_account_ckb,
            crate::types::Chain::Btc => &g.outpoints_by_account_btc,
        };
        Ok(map.get(account).cloned().unwrap_or_default())
    }

    async fn event_by_input(&self, tx_hash: &str, index: u32) -> Result<Option<RgbppEvent>> {
        Ok(self.inner.read().unwrap().event_by_input.get(&(tx_hash.into(), index)).cloned())
    }
    async fn event_by_output(&self, tx_hash: &str, index: u32) -> Result<Option<RgbppEvent>> {
        Ok(self.inner.read().unwrap().event_by_output.get(&(tx_hash.into(), index)).cloned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Chain;

    fn mk_balance(acc: &str, token: &str, amt: &str) -> AccountBalance {
        AccountBalance { account: acc.into(), token: token.into(), amount: amt.into() }
    }

    #[tokio::test]
    async fn memory_dao_balance_filters_by_account() {
        let d = MemoryDao::new();
        d.insert_balance(mk_balance("A", "T1", "10"));
        d.insert_balance(mk_balance("B", "T1", "20"));
        let r = d.balances_for("A", &[]).await.unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].account, "A");
    }

    #[tokio::test]
    async fn memory_dao_balance_filters_by_token() {
        let d = MemoryDao::new();
        d.insert_balance(mk_balance("A", "T1", "10"));
        d.insert_balance(mk_balance("A", "T2", "99"));
        let r = d.balances_for("A", &["T1".into()]).await.unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].token, "T1");
    }

    #[tokio::test]
    async fn memory_dao_holders_scoped_per_token() {
        let d = MemoryDao::new();
        d.insert_holder(TokenHolder { token: "T1".into(), account: "A".into(), amount: "1".into() });
        d.insert_holder(TokenHolder { token: "T2".into(), account: "A".into(), amount: "2".into() });
        assert_eq!(d.holders_for("T1").await.unwrap().len(), 1);
        assert_eq!(d.holders_for("NONE").await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn memory_dao_tokens_filter() {
        let d = MemoryDao::new();
        d.insert_token(TokenInfo {
            token: "T1".into(), name: None, symbol: None, decimals: None,
            supply: "10".into(), holders: 1,
        });
        d.insert_token(TokenInfo {
            token: "T2".into(), name: None, symbol: None, decimals: None,
            supply: "20".into(), holders: 2,
        });
        assert_eq!(d.tokens(&[]).await.unwrap().len(), 2);
        assert_eq!(d.tokens(&["T1".into()]).await.unwrap().len(), 1);
        assert_eq!(d.tokens(&["UNKNOWN".into()]).await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn memory_dao_outpoints_scoped_per_chain() {
        let d = MemoryDao::new();
        let op_c = TokenOutPoint {
            out_point: OutPoint { tx_hash: "0xa".into(), index: 0 },
            token: "T".into(), amount: "1".into(),
        };
        let op_b = TokenOutPoint {
            out_point: OutPoint { tx_hash: "0xb".into(), index: 0 },
            token: "T".into(), amount: "1".into(),
        };
        d.insert_outpoint("acc", Chain::Ckb, op_c.clone());
        d.insert_outpoint("acc", Chain::Btc, op_b.clone());
        assert_eq!(d.outpoints_for("acc", Chain::Ckb).await.unwrap(), vec![op_c]);
        assert_eq!(d.outpoints_for("acc", Chain::Btc).await.unwrap(), vec![op_b]);
    }

    #[tokio::test]
    async fn memory_dao_event_by_input_and_output_are_separate_tables() {
        let d = MemoryDao::new();
        let e = RgbppEvent {
            ckb_tx_hash: "0x1".into(), ckb_block_number: 10, btc_tx_hash: None,
            input: None, output: None, token: "T".into(), amount: "1".into(),
            from: None, to: None,
        };
        d.insert_event_by_input("0x1", 0, e.clone());
        assert!(d.event_by_input("0x1", 0).await.unwrap().is_some());
        assert!(d.event_by_output("0x1", 0).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn memory_dao_default_tips_none() {
        let d = MemoryDao::new();
        assert!(d.tip_block_ckb().await.unwrap().is_none());
        d.set_tip(Some(100), Some(200));
        assert_eq!(d.tip_block_ckb().await.unwrap(), Some(100));
        assert_eq!(d.tip_block_btc().await.unwrap(), Some(200));
    }
}
