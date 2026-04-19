//! redb-backed `Dao` implementation.
//!
//! Table names match what the closed-source ELF stores (recovered from
//! rodata): `rgbpp_balances`, `rgbpp_holders`, `rgbpp_tokens`,
//! `rgbpp_by_input`, `rgbpp_by_output`, `rgbpp_script`.
//!
//! Values are stored as **JSON bytes** so the schema is self-describing
//! and we can iterate a cold database without matching a binary layout.
//! This is a pragmatic choice — the closed-source ELF uses molecule
//! codec, but the indexer already pays molecule decode cost once per
//! block, and redb lookups are already fast enough that JSON overhead
//! is in the noise.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use async_trait::async_trait;
use redb::{Database, ReadableTable, TableDefinition};

use crate::{
    dao::Dao,
    error::{Error, Result},
    types::{
        AccountBalance, Chain, OutPoint, RgbppEvent, TokenHolder, TokenInfo, TokenOutPoint,
    },
};

// ── Table definitions ───────────────────────────────────────────────
// Every table stores JSON-encoded payloads under a string key that
// uniquely identifies the row across the indexed space.
const BALANCES_T: TableDefinition<&str, &[u8]> = TableDefinition::new("rgbpp_balances");
const HOLDERS_T:  TableDefinition<&str, &[u8]> = TableDefinition::new("rgbpp_holders");
const TOKENS_T:   TableDefinition<&str, &[u8]> = TableDefinition::new("rgbpp_tokens");
const INPUT_T:    TableDefinition<&str, &[u8]> = TableDefinition::new("rgbpp_by_input");
const OUTPUT_T:   TableDefinition<&str, &[u8]> = TableDefinition::new("rgbpp_by_output");
const SCRIPT_T:   TableDefinition<&str, &[u8]> = TableDefinition::new("rgbpp_script");
const META_T:     TableDefinition<&str, u64>   = TableDefinition::new("rgbpp_meta");

pub struct RedbDao {
    db: Arc<Database>,
    #[allow(dead_code)]
    path: PathBuf,
}

impl RedbDao {
    pub fn open(path: &Path) -> Result<Self> {
        let db = Database::create(path)
            .map_err(|e| Error::Dao(format!("open {path:?}: {e}")))?;
        // Touch every table up-front so cold DB reads of empty tables
        // don't fail with "table not found".
        let tx = db.begin_write().map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(BALANCES_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(HOLDERS_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(TOKENS_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(INPUT_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(OUTPUT_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(SCRIPT_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.open_table(META_T).map_err(|e| Error::Dao(e.to_string()))?;
        tx.commit().map_err(|e| Error::Dao(e.to_string()))?;
        Ok(Self { db: Arc::new(db), path: path.to_path_buf() })
    }

    // ── Write surface for the indexer loop ──────────────────────────
    pub fn put_balance(&self, b: &AccountBalance) -> Result<()> {
        let key = format!("{}|{}", b.account, b.token);
        self.put_json(BALANCES_T, &key, b)
    }
    pub fn put_holder(&self, h: &TokenHolder) -> Result<()> {
        let key = format!("{}|{}", h.token, h.account);
        self.put_json(HOLDERS_T, &key, h)
    }
    pub fn put_token(&self, t: &TokenInfo) -> Result<()> {
        self.put_json(TOKENS_T, &t.token, t)
    }
    pub fn put_event_by_input(&self, tx_hash: &str, idx: u32, e: &RgbppEvent) -> Result<()> {
        let key = format!("{tx_hash}|{idx}");
        self.put_json(INPUT_T, &key, e)
    }
    pub fn put_event_by_output(&self, tx_hash: &str, idx: u32, e: &RgbppEvent) -> Result<()> {
        let key = format!("{tx_hash}|{idx}");
        self.put_json(OUTPUT_T, &key, e)
    }
    pub fn put_outpoint(
        &self,
        account: &str,
        chain: Chain,
        op: &TokenOutPoint,
    ) -> Result<()> {
        let chain_tag = match chain { Chain::Ckb => "ckb", Chain::Btc => "btc" };
        let key = format!("{chain_tag}|{account}|{}|{}", op.out_point.tx_hash, op.out_point.index);
        self.put_json(SCRIPT_T, &key, op)
    }
    pub fn set_tip(&self, chain: Chain, block: u64) -> Result<()> {
        let key = match chain { Chain::Ckb => "tip_ckb", Chain::Btc => "tip_btc" };
        let tx = self.db.begin_write().map_err(|e| Error::Dao(e.to_string()))?;
        {
            let mut t = tx.open_table(META_T).map_err(|e| Error::Dao(e.to_string()))?;
            t.insert(key, block).map_err(|e| Error::Dao(e.to_string()))?;
        }
        tx.commit().map_err(|e| Error::Dao(e.to_string()))?;
        Ok(())
    }

    // ── internal helpers ────────────────────────────────────────────
    fn put_json<T: serde::Serialize>(
        &self,
        def: TableDefinition<&str, &[u8]>,
        key: &str,
        value: &T,
    ) -> Result<()> {
        let bytes = serde_json::to_vec(value)?;
        let tx = self.db.begin_write().map_err(|e| Error::Dao(e.to_string()))?;
        {
            let mut t = tx.open_table(def).map_err(|e| Error::Dao(e.to_string()))?;
            t.insert(key, bytes.as_slice()).map_err(|e| Error::Dao(e.to_string()))?;
        }
        tx.commit().map_err(|e| Error::Dao(e.to_string()))?;
        Ok(())
    }

    fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        def: TableDefinition<&str, &[u8]>,
        key: &str,
    ) -> Result<Option<T>> {
        let tx = self.db.begin_read().map_err(|e| Error::Dao(e.to_string()))?;
        let t = tx.open_table(def).map_err(|e| Error::Dao(e.to_string()))?;
        let g = t.get(key).map_err(|e| Error::Dao(e.to_string()))?;
        match g {
            Some(v) => Ok(Some(serde_json::from_slice(v.value())?)),
            None => Ok(None),
        }
    }

    fn scan_prefix<T: serde::de::DeserializeOwned>(
        &self,
        def: TableDefinition<&str, &[u8]>,
        prefix: &str,
    ) -> Result<Vec<T>> {
        let tx = self.db.begin_read().map_err(|e| Error::Dao(e.to_string()))?;
        let t = tx.open_table(def).map_err(|e| Error::Dao(e.to_string()))?;
        // Bound the range by the next lexicographic successor to avoid
        // a full table scan on large tables.
        let upper = prefix_successor(prefix);
        let range: Box<dyn Iterator<Item = _>> = match upper {
            Some(ref u) => Box::new(
                t.range(prefix..u.as_str()).map_err(|e| Error::Dao(e.to_string()))?
            ),
            None => Box::new(
                t.range::<&str>(prefix..).map_err(|e| Error::Dao(e.to_string()))?
            ),
        };
        let mut out = Vec::new();
        for row in range {
            let (_k, v) = row.map_err(|e| Error::Dao(e.to_string()))?;
            out.push(serde_json::from_slice(v.value())?);
        }
        Ok(out)
    }

    fn scan_all<T: serde::de::DeserializeOwned>(
        &self,
        def: TableDefinition<&str, &[u8]>,
    ) -> Result<Vec<T>> {
        let tx = self.db.begin_read().map_err(|e| Error::Dao(e.to_string()))?;
        let t = tx.open_table(def).map_err(|e| Error::Dao(e.to_string()))?;
        let mut out = Vec::new();
        for row in t.iter().map_err(|e| Error::Dao(e.to_string()))? {
            let (_k, v) = row.map_err(|e| Error::Dao(e.to_string()))?;
            out.push(serde_json::from_slice(v.value())?);
        }
        Ok(out)
    }
}

/// Given a prefix `p`, return the smallest string strictly greater than
/// every string that starts with `p`. Used as an exclusive upper bound
/// for redb `range(..)` calls.
///
/// `None` ⇒ the prefix is all `0xFF` bytes and has no successor; callers
/// should fall back to unbounded range.
pub fn prefix_successor(prefix: &str) -> Option<String> {
    let mut bytes = prefix.as_bytes().to_vec();
    while let Some(last) = bytes.last_mut() {
        if *last < 0xFF {
            *last += 1;
            // Valid UTF-8 because the input was valid UTF-8 and we only
            // incremented an ASCII-range byte (callers always pass ASCII
            // separators — keys use 0-9, a-z, '|', '0x', 'ckb'/'btc').
            return Some(String::from_utf8(bytes).unwrap_or_else(|_| prefix.to_string()));
        }
        bytes.pop();
    }
    None
}

#[async_trait]
impl Dao for RedbDao {
    async fn tip_block_ckb(&self) -> Result<Option<u64>> {
        let tx = self.db.begin_read().map_err(|e| Error::Dao(e.to_string()))?;
        let t = tx.open_table(META_T).map_err(|e| Error::Dao(e.to_string()))?;
        Ok(t.get("tip_ckb").map_err(|e| Error::Dao(e.to_string()))?.map(|g| g.value()))
    }
    async fn tip_block_btc(&self) -> Result<Option<u64>> {
        let tx = self.db.begin_read().map_err(|e| Error::Dao(e.to_string()))?;
        let t = tx.open_table(META_T).map_err(|e| Error::Dao(e.to_string()))?;
        Ok(t.get("tip_btc").map_err(|e| Error::Dao(e.to_string()))?.map(|g| g.value()))
    }

    async fn balances_for(&self, account: &str, tokens: &[String]) -> Result<Vec<AccountBalance>> {
        let prefix = format!("{account}|");
        let rows: Vec<AccountBalance> = self.scan_prefix(BALANCES_T, &prefix)?;
        Ok(rows.into_iter()
            .filter(|b| b.account == account && (tokens.is_empty() || tokens.iter().any(|t| t == &b.token)))
            .collect())
    }

    async fn holders_for(&self, token: &str) -> Result<Vec<TokenHolder>> {
        let prefix = format!("{token}|");
        Ok(self.scan_prefix(HOLDERS_T, &prefix)?)
    }

    async fn tokens(&self, filter: &[String]) -> Result<Vec<TokenInfo>> {
        if filter.is_empty() {
            return self.scan_all(TOKENS_T);
        }
        let mut out = Vec::with_capacity(filter.len());
        for t in filter {
            if let Some(info) = self.get_json::<TokenInfo>(TOKENS_T, t)? {
                out.push(info);
            }
        }
        Ok(out)
    }

    async fn outpoints_for(&self, account: &str, chain: Chain) -> Result<Vec<TokenOutPoint>> {
        let chain_tag = match chain { Chain::Ckb => "ckb", Chain::Btc => "btc" };
        let prefix = format!("{chain_tag}|{account}|");
        self.scan_prefix(SCRIPT_T, &prefix)
    }

    async fn event_by_input(&self, tx_hash: &str, index: u32) -> Result<Option<RgbppEvent>> {
        let key = format!("{tx_hash}|{index}");
        self.get_json(INPUT_T, &key)
    }
    async fn event_by_output(&self, tx_hash: &str, index: u32) -> Result<Option<RgbppEvent>> {
        let key = format!("{tx_hash}|{index}");
        self.get_json(OUTPUT_T, &key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefix_successor_basic_ascii() {
        assert_eq!(prefix_successor("ab"), Some("ac".into()));
        assert_eq!(prefix_successor("a"), Some("b".into()));
        assert_eq!(prefix_successor("ckb|A|"), Some("ckb|A}".into()));
    }

    #[test]
    fn prefix_successor_empty() {
        assert_eq!(prefix_successor(""), None);
    }

    fn mk_dao() -> (tempfile::TempDir, RedbDao) {
        let d = tempfile::tempdir().unwrap();
        let dao = RedbDao::open(&d.path().join("t.redb")).unwrap();
        (d, dao)
    }

    #[tokio::test]
    async fn empty_dao_returns_empty() {
        let (_d, dao) = mk_dao();
        assert!(dao.balances_for("x", &[]).await.unwrap().is_empty());
        assert!(dao.holders_for("T").await.unwrap().is_empty());
        assert!(dao.tokens(&[]).await.unwrap().is_empty());
        assert!(dao.tip_block_ckb().await.unwrap().is_none());
        assert!(dao.tip_block_btc().await.unwrap().is_none());
        assert!(dao.event_by_input("t", 0).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn round_trip_balance() {
        let (_d, dao) = mk_dao();
        let b = AccountBalance {
            account: "A".into(), token: "T1".into(), amount: "10".into(),
        };
        dao.put_balance(&b).unwrap();
        let got = dao.balances_for("A", &[]).await.unwrap();
        assert_eq!(got, vec![b]);
    }

    #[tokio::test]
    async fn balance_token_filter_is_applied() {
        let (_d, dao) = mk_dao();
        dao.put_balance(&AccountBalance { account: "A".into(), token: "T1".into(), amount: "1".into() }).unwrap();
        dao.put_balance(&AccountBalance { account: "A".into(), token: "T2".into(), amount: "2".into() }).unwrap();
        dao.put_balance(&AccountBalance { account: "B".into(), token: "T1".into(), amount: "9".into() }).unwrap();
        let got = dao.balances_for("A", &["T2".into()]).await.unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].token, "T2");
    }

    #[tokio::test]
    async fn holders_scoped_per_token() {
        let (_d, dao) = mk_dao();
        for i in 0..3 {
            dao.put_holder(&TokenHolder {
                token: "T1".into(), account: format!("A{i}"), amount: "1".into(),
            }).unwrap();
        }
        dao.put_holder(&TokenHolder { token: "T2".into(), account: "Zzz".into(), amount: "1".into() }).unwrap();
        assert_eq!(dao.holders_for("T1").await.unwrap().len(), 3);
        assert_eq!(dao.holders_for("T2").await.unwrap().len(), 1);
        assert_eq!(dao.holders_for("NONE").await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn tokens_filter_selects_exact_set() {
        let (_d, dao) = mk_dao();
        for n in ["T1", "T2", "T3"] {
            dao.put_token(&TokenInfo {
                token: n.into(), name: None, symbol: None, decimals: None,
                supply: "10".into(), holders: 1,
            }).unwrap();
        }
        assert_eq!(dao.tokens(&[]).await.unwrap().len(), 3);
        let picked = dao.tokens(&["T1".into(), "T3".into(), "UNKNOWN".into()]).await.unwrap();
        assert_eq!(picked.len(), 2);
    }

    #[tokio::test]
    async fn outpoints_scoped_per_chain_and_account() {
        let (_d, dao) = mk_dao();
        let op = TokenOutPoint {
            out_point: OutPoint { tx_hash: "0xa".into(), index: 0 },
            token: "T".into(), amount: "1".into(),
        };
        dao.put_outpoint("acc", Chain::Ckb, &op).unwrap();
        dao.put_outpoint("acc", Chain::Btc, &op).unwrap();
        dao.put_outpoint("other", Chain::Ckb, &op).unwrap();
        assert_eq!(dao.outpoints_for("acc", Chain::Ckb).await.unwrap().len(), 1);
        assert_eq!(dao.outpoints_for("acc", Chain::Btc).await.unwrap().len(), 1);
        assert_eq!(dao.outpoints_for("missing", Chain::Ckb).await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn events_by_input_and_output_are_separate() {
        let (_d, dao) = mk_dao();
        let e = RgbppEvent {
            ckb_tx_hash: "0x1".into(), ckb_block_number: 10, btc_tx_hash: None,
            input: None, output: None, token: "T".into(), amount: "1".into(),
            from: None, to: None,
        };
        dao.put_event_by_input("0x1", 0, &e).unwrap();
        assert!(dao.event_by_input("0x1", 0).await.unwrap().is_some());
        assert!(dao.event_by_output("0x1", 0).await.unwrap().is_none());
        dao.put_event_by_output("0x1", 0, &e).unwrap();
        assert!(dao.event_by_output("0x1", 0).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn tips_are_per_chain() {
        let (_d, dao) = mk_dao();
        dao.set_tip(Chain::Ckb, 100).unwrap();
        dao.set_tip(Chain::Btc, 200).unwrap();
        assert_eq!(dao.tip_block_ckb().await.unwrap(), Some(100));
        assert_eq!(dao.tip_block_btc().await.unwrap(), Some(200));
    }

    #[tokio::test]
    async fn persistence_across_reopen() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("x.redb");
        {
            let dao = RedbDao::open(&p).unwrap();
            dao.put_token(&TokenInfo {
                token: "T".into(), name: None, symbol: None, decimals: None,
                supply: "9".into(), holders: 1,
            }).unwrap();
        }
        let dao2 = RedbDao::open(&p).unwrap();
        let all = dao2.tokens(&[]).await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].token, "T");
    }

    #[tokio::test]
    async fn prefix_scan_does_not_leak_across_tokens() {
        // Check that holders_for("T") doesn't accidentally return rows
        // whose token starts with "T" but isn't exactly "T" — e.g.
        // "T10" shouldn't appear under "T".
        let (_d, dao) = mk_dao();
        dao.put_holder(&TokenHolder { token: "T".into(), account: "x".into(), amount: "1".into() }).unwrap();
        dao.put_holder(&TokenHolder { token: "T10".into(), account: "y".into(), amount: "1".into() }).unwrap();
        let t = dao.holders_for("T").await.unwrap();
        assert_eq!(t.len(), 1);
        assert_eq!(t[0].account, "x");
    }
}
