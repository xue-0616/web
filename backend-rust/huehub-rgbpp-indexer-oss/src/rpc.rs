//! jsonrpsee JSON-RPC server — 6 methods, matching the ELF rodata.

use std::sync::Arc;

use jsonrpsee::{RpcModule, types::ErrorObjectOwned};

use crate::{
    dao::Dao,
    pagination::page_holders,
    types::{
        AccountBalancesRequest, AccountBalancesResponse, AccountTokenOutpointsRequest,
        AccountTokenOutpointsResponse, TokenHoldersRequest, TokenHoldersResponse, TokenInfo,
        TokensRequest, RgbppEvent,
    },
};

pub fn build_module<D: Dao>(dao: Arc<D>) -> RpcModule<Arc<D>> {
    let mut m = RpcModule::new(dao);

    m.register_async_method("rgbpp_balances", |params, dao, _| async move {
        let req: AccountBalancesRequest = params.parse()?;
        let rows = dao.balances_for(&req.account, &req.tokens).await
            .map_err(ErrorObjectOwned::from)?;
        Ok::<_, ErrorObjectOwned>(AccountBalancesResponse { balances: rows })
    }).expect("register rgbpp_balances");

    m.register_async_method("rgbpp_holders", |params, dao, _| async move {
        let req: TokenHoldersRequest = params.parse()?;
        let all = dao.holders_for(&req.token).await.map_err(ErrorObjectOwned::from)?;
        let (holders, next) = page_holders(&all, req.pagination.as_ref())
            .map_err(ErrorObjectOwned::from)?;
        Ok::<_, ErrorObjectOwned>(TokenHoldersResponse { holders, next })
    }).expect("register rgbpp_holders");

    m.register_async_method("rgbpp_tokens", |params, dao, _| async move {
        let req: TokensRequest = params.parse().unwrap_or(TokensRequest { tokens: vec![] });
        let rows: Vec<TokenInfo> = dao.tokens(&req.tokens).await.map_err(ErrorObjectOwned::from)?;
        Ok::<_, ErrorObjectOwned>(rows)
    }).expect("register rgbpp_tokens");

    m.register_async_method("rgbpp_by_input", |params, dao, _| async move {
        let (tx_hash, idx): (String, u32) = params.parse()?;
        let ev: Option<RgbppEvent> = dao.event_by_input(&tx_hash, idx).await
            .map_err(ErrorObjectOwned::from)?;
        Ok::<_, ErrorObjectOwned>(ev)
    }).expect("register rgbpp_by_input");

    m.register_async_method("rgbpp_by_output", |params, dao, _| async move {
        let (tx_hash, idx): (String, u32) = params.parse()?;
        let ev: Option<RgbppEvent> = dao.event_by_output(&tx_hash, idx).await
            .map_err(ErrorObjectOwned::from)?;
        Ok::<_, ErrorObjectOwned>(ev)
    }).expect("register rgbpp_by_output");

    m.register_async_method("rgbpp_script", |params, dao, _| async move {
        let req: AccountTokenOutpointsRequest = params.parse()?;
        let outpoints = dao.outpoints_for(&req.account, req.chain).await
            .map_err(ErrorObjectOwned::from)?;
        Ok::<_, ErrorObjectOwned>(AccountTokenOutpointsResponse { outpoints })
    }).expect("register rgbpp_script");

    m
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        dao::MemoryDao,
        types::{AccountBalance, Chain, OutPoint, RgbppEvent, TokenHolder, TokenInfo, TokenOutPoint},
    };
    use jsonrpsee::core::RpcResult;
    use serde_json::Value;

    async fn call<T: serde::de::DeserializeOwned>(
        module: &RpcModule<Arc<MemoryDao>>,
        method: &str,
        params: Value,
    ) -> RpcResult<T> {
        let (resp, _) = module
            .raw_json_request(
                &format!(
                    r#"{{"jsonrpc":"2.0","id":1,"method":"{method}","params":{params}}}"#
                ),
                1,
            )
            .await
            .unwrap();
        let v: Value = serde_json::from_str(&resp).unwrap();
        if let Some(err) = v.get("error") {
            let code = err["code"].as_i64().unwrap_or(0) as i32;
            let msg = err["message"].as_str().unwrap_or("").to_string();
            return Err(ErrorObjectOwned::owned::<()>(code, msg, None));
        }
        Ok(serde_json::from_value(v["result"].clone()).unwrap())
    }

    fn seeded_dao() -> Arc<MemoryDao> {
        let d = Arc::new(MemoryDao::new());
        d.insert_balance(AccountBalance {
            account: "A".into(), token: "T1".into(), amount: "10".into(),
        });
        d.insert_balance(AccountBalance {
            account: "A".into(), token: "T2".into(), amount: "20".into(),
        });
        for i in 0..5 {
            d.insert_holder(TokenHolder {
                token: "T1".into(),
                account: format!("acc{i}"),
                amount: "1".into(),
            });
        }
        d.insert_token(TokenInfo {
            token: "T1".into(), name: Some("Coin".into()), symbol: Some("C".into()),
            decimals: Some(8), supply: "1000".into(), holders: 5,
        });
        d.insert_outpoint("A", Chain::Ckb, TokenOutPoint {
            out_point: OutPoint { tx_hash: "0xa".into(), index: 0 },
            token: "T1".into(), amount: "5".into(),
        });
        d.insert_event_by_input("0xt", 0, RgbppEvent {
            ckb_tx_hash: "0xt".into(), ckb_block_number: 7, btc_tx_hash: None,
            input: Some(OutPoint { tx_hash: "0xt".into(), index: 0 }),
            output: None, token: "T1".into(), amount: "5".into(),
            from: None, to: None,
        });
        d
    }

    #[tokio::test]
    async fn rgbpp_balances_returns_rows() {
        let m = build_module(seeded_dao());
        let r: AccountBalancesResponse = call(&m, "rgbpp_balances",
            serde_json::json!({"account":"A","tokens":[]})).await.unwrap();
        assert_eq!(r.balances.len(), 2);
    }

    #[tokio::test]
    async fn rgbpp_balances_filters_by_token() {
        let m = build_module(seeded_dao());
        let r: AccountBalancesResponse = call(&m, "rgbpp_balances",
            serde_json::json!({"account":"A","tokens":["T1"]})).await.unwrap();
        assert_eq!(r.balances.len(), 1);
        assert_eq!(r.balances[0].token, "T1");
    }

    #[tokio::test]
    async fn rgbpp_holders_paginates() {
        let m = build_module(seeded_dao());
        let r: TokenHoldersResponse = call(&m, "rgbpp_holders",
            serde_json::json!({"token":"T1","pagination":{"limit":2}})).await.unwrap();
        assert_eq!(r.holders.len(), 2);
        assert!(r.next.is_some());
    }

    #[tokio::test]
    async fn rgbpp_holders_full_page_no_cursor() {
        let m = build_module(seeded_dao());
        let r: TokenHoldersResponse = call(&m, "rgbpp_holders",
            serde_json::json!({"token":"T1"})).await.unwrap();
        assert_eq!(r.holders.len(), 5);
        assert!(r.next.is_none());
    }

    #[tokio::test]
    async fn rgbpp_tokens_returns_all_when_empty_filter() {
        let m = build_module(seeded_dao());
        let r: Vec<TokenInfo> = call(&m, "rgbpp_tokens",
            serde_json::json!({"tokens":[]})).await.unwrap();
        assert_eq!(r.len(), 1);
    }

    #[tokio::test]
    async fn rgbpp_by_input_hit_and_miss() {
        let m = build_module(seeded_dao());
        let r: Option<RgbppEvent> = call(&m, "rgbpp_by_input",
            serde_json::json!(["0xt", 0])).await.unwrap();
        assert!(r.is_some());
        let miss: Option<RgbppEvent> = call(&m, "rgbpp_by_input",
            serde_json::json!(["0xt", 99])).await.unwrap();
        assert!(miss.is_none());
    }

    #[tokio::test]
    async fn rgbpp_by_output_returns_none_when_not_seen() {
        let m = build_module(seeded_dao());
        let r: Option<RgbppEvent> = call(&m, "rgbpp_by_output",
            serde_json::json!(["0xt", 0])).await.unwrap();
        assert!(r.is_none(), "seeded only in by_input table, not by_output");
    }

    #[tokio::test]
    async fn rgbpp_script_returns_per_chain() {
        let m = build_module(seeded_dao());
        let r: AccountTokenOutpointsResponse = call(&m, "rgbpp_script",
            serde_json::json!({"account":"A","chain":"ckb"})).await.unwrap();
        assert_eq!(r.outpoints.len(), 1);
        let btc: AccountTokenOutpointsResponse = call(&m, "rgbpp_script",
            serde_json::json!({"account":"A","chain":"btc"})).await.unwrap();
        assert_eq!(btc.outpoints.len(), 0);
    }

    #[tokio::test]
    async fn unknown_cursor_returns_invalid_params() {
        let m = build_module(seeded_dao());
        let err = call::<TokenHoldersResponse>(&m, "rgbpp_holders",
            serde_json::json!({"token":"T1","pagination":{"limit":2,"after":"T1:ghost"}})).await
            .unwrap_err();
        assert_eq!(err.code(), -32602);
    }

    #[tokio::test]
    async fn invalid_params_shape_rejected() {
        let m = build_module(seeded_dao());
        let err = call::<AccountBalancesResponse>(&m, "rgbpp_balances",
            serde_json::json!({"wrong":"field"})).await.unwrap_err();
        // jsonrpsee surfaces this as -32602 (invalid params).
        assert_eq!(err.code(), -32602);
    }
}
