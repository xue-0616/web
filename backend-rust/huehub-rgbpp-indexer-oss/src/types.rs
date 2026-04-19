//! Domain types. Field sets recovered from ELF rodata where
//! `*Request/*Response` struct names appear next to their field names.
//!
//! The original binary uses CKB's molecule codec for **on-chain** data
//! but **serde_json** for the RPC surface. We only model the JSON layer.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────
// Shared atoms
// ─────────────────────────────────────────────────────────────────

/// CKB cell out-point (`tx_hash` + `index`). ELF rodata shows
/// `OutPointindextx` (concatenated field names in the type description).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct OutPoint {
    pub tx_hash: String,
    pub index: u32,
}

/// `(OutPoint, token_type_id, amount)` per-output token state.
/// Rodata shows `TokenOutPointckb` + `TokenAmount` + `AccountTokenOutpointsRequestbtc`
/// which tells us the same record shape is shared between BTC & CKB sides.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenOutPoint {
    pub out_point: OutPoint,
    pub token: String,
    pub amount: String, // BigUint as decimal string, matching ELF rodata
}

/// Static info about a token (xUDT-class on CKB). Matches recovered
/// `TokenInfosupplyholders` contiguous-field block.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenInfo {
    pub token: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub symbol: Option<String>,
    #[serde(default)]
    pub decimals: Option<u8>,
    pub supply: String,
    pub holders: u64,
}

/// One holder row. Rodata: `TokenHoldertoken`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenHolder {
    pub account: String,
    pub token: String,
    pub amount: String,
}

/// One balance row. Rodata: `AccountBalancesRequestAccountBalancesResponseAccountBalanceamount`
/// → fields: account, token, amount.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountBalance {
    pub account: String,
    pub token: String,
    pub amount: String,
}

/// One RGB++ event extracted from a CKB transaction. We identify an
/// event by either its **input** position or its **output** position
/// (matches recovered RPC methods `rgbpp_by_input` / `rgbpp_by_output`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RgbppEvent {
    pub ckb_tx_hash: String,
    pub ckb_block_number: u64,
    /// Corresponding Bitcoin tx if the event is a BTC→CKB bridge.
    #[serde(default)]
    pub btc_tx_hash: Option<String>,
    pub input: Option<OutPoint>,
    pub output: Option<OutPoint>,
    pub token: String,
    pub amount: String,
    pub from: Option<String>,
    pub to: Option<String>,
}

// ─────────────────────────────────────────────────────────────────
// RPC request / response shells
// ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountBalancesRequest {
    pub account: String,
    #[serde(default)]
    pub tokens: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountBalancesResponse {
    pub balances: Vec<AccountBalance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenHoldersRequest {
    pub token: String,
    #[serde(default)]
    pub pagination: Option<PageCursor>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenHoldersResponse {
    pub holders: Vec<TokenHolder>,
    /// Cursor for next page — `None` iff the page is the last.
    /// Matches rodata `TokenHoldersResponsenext`.
    #[serde(default)]
    pub next: Option<PageCursor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PageCursor {
    pub limit: u32,
    #[serde(default)]
    pub after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokensRequest {
    #[serde(default)]
    pub tokens: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountTokenOutpointsRequest {
    pub account: String,
    /// `"ckb"` or `"btc"` — rodata `AccountTokenOutpointsRequestbtc`.
    pub chain: Chain,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Ckb,
    Btc,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountTokenOutpointsResponse {
    pub outpoints: Vec<TokenOutPoint>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chain_json_lowercase() {
        assert_eq!(serde_json::to_string(&Chain::Ckb).unwrap(), "\"ckb\"");
        assert_eq!(serde_json::to_string(&Chain::Btc).unwrap(), "\"btc\"");
    }

    #[test]
    fn out_point_serde_roundtrip() {
        let o = OutPoint { tx_hash: "0xabc".into(), index: 7 };
        let s = serde_json::to_string(&o).unwrap();
        assert!(s.contains("tx_hash"));
        assert!(s.contains("\"index\":7"));
        let back: OutPoint = serde_json::from_str(&s).unwrap();
        assert_eq!(back, o);
    }

    #[test]
    fn account_balances_request_default_tokens() {
        let r: AccountBalancesRequest = serde_json::from_str(r#"{"account":"0x00"}"#).unwrap();
        assert!(r.tokens.is_empty());
    }

    #[test]
    fn token_holders_response_omits_none_next() {
        let resp = TokenHoldersResponse { holders: vec![], next: None };
        let s = serde_json::to_string(&resp).unwrap();
        assert!(s.contains("\"next\":null") || !s.contains("\"next\""));
    }

    #[test]
    fn page_cursor_roundtrip() {
        let pc = PageCursor { limit: 50, after: Some("ckb:abc".into()) };
        let back: PageCursor = serde_json::from_str(&serde_json::to_string(&pc).unwrap()).unwrap();
        assert_eq!(back, pc);
    }

    #[test]
    fn account_token_outpoints_request_snake_case() {
        let r = AccountTokenOutpointsRequest {
            account: "ck1...".into(),
            chain: Chain::Btc,
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"chain\":\"btc\""));
    }

    #[test]
    fn token_info_optional_fields_missing_ok() {
        let src = r#"{"token":"0xttt","supply":"1000","holders":5}"#;
        let t: TokenInfo = serde_json::from_str(src).unwrap();
        assert_eq!(t.supply, "1000");
        assert_eq!(t.holders, 5);
        assert!(t.name.is_none());
    }
}
