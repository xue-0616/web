//! End-to-end: spin up a real jsonrpsee server on an ephemeral port,
//! issue `pm_sponsorUserOperation` + `pm_supportedEntryPoints` via a raw
//! HTTP JSON-RPC client, verify the response round-trip.
//!
//! This exercises the full serialization layer (UserOperation JSON shape,
//! Bytes hex encoding) in a way unit tests cannot.

use std::{collections::HashMap, sync::Arc, time::Duration};

use ethers_core::types::{Address, Bytes, U256};
use jsonrpsee::server::Server;
use serde_json::json;

use paymaster_service_oss::{
    config::{ChainConfig, Config},
    paymaster::Paymaster,
    rpc::{PaymasterRpcImpl, PaymasterRpcServer as _},
    user_operation::UserOperation,
};

fn mk_paymaster() -> Arc<Paymaster> {
    let mut chains = HashMap::new();
    chains.insert(
        1,
        ChainConfig {
            paymaster_address: Address::repeat_byte(0x01),
            entry_point: Address::repeat_byte(0xEE),
            rpc_url: None,
        },
    );
    Arc::new(
        Paymaster::new(Arc::new(Config {
            bind: "0.0.0.0:0".into(),
            signer_private_key: "0x1111111111111111111111111111111111111111111111111111111111111111".into(),
            chains,
            whitelist: vec![],
            validity_window_secs: 600,
        }))
        .unwrap(),
    )
}

async fn spawn_server() -> (String, jsonrpsee::server::ServerHandle) {
    let pm = mk_paymaster();
    let server = Server::builder()
        .build("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = server.local_addr().expect("addr");
    let module = PaymasterRpcImpl { paymaster: pm }.into_rpc();
    let handle = server.start(module);
    (format!("http://{addr}"), handle)
}

fn sample_op_json(sender: &str) -> serde_json::Value {
    json!({
        "sender": sender,
        "nonce": "0x1",
        "initCode": "0x",
        "callData": "0xdead",
        "callGasLimit": "0x186a0",
        "verificationGasLimit": "0x186a0",
        "preVerificationGas": "0x5208",
        "maxFeePerGas": "0x3b9aca00",
        "maxPriorityFeePerGas": "0x3b9aca00",
        "paymasterAndData": "0x",
        "signature": "0x"
    })
}

#[tokio::test]
async fn supported_entry_points_end_to_end() {
    let (url, handle) = spawn_server().await;
    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .post(&url)
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "pm_supportedEntryPoints",
            "params": []
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(resp["jsonrpc"], "2.0");
    let result = resp["result"].as_array().unwrap();
    assert_eq!(result.len(), 1);
    assert!(result[0]
        .as_str()
        .unwrap()
        .to_ascii_lowercase()
        .ends_with("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"));
    handle.stop().unwrap();
    tokio::time::timeout(Duration::from_secs(2), handle.stopped()).await.ok();
}

#[tokio::test]
async fn sponsor_end_to_end() {
    let (url, handle) = spawn_server().await;
    let client = reqwest::Client::new();
    let op = sample_op_json("0xabababababababababababababababababababab");
    let ep = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let resp: serde_json::Value = client
        .post(&url)
        .json(&json!({
            "jsonrpc": "2.0", "id": 1,
            "method": "pm_sponsorUserOperation",
            "params": [op, ep, 1]
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert!(resp.get("error").is_none(), "rpc error: {resp}");
    let result = &resp["result"];
    let pad = result["paymasterAndData"].as_str().unwrap();
    // 2 + (20 + 64 + 65) * 2 = 300 chars
    assert_eq!(pad.len(), 2 + (20 + 64 + 65) * 2);
    assert!(pad.starts_with("0x"));
    // first 20 bytes = paymaster_address 0x01..01
    assert!(pad[2..42].chars().all(|c| c == '0' || c == '1'));
    handle.stop().unwrap();
    tokio::time::timeout(Duration::from_secs(2), handle.stopped()).await.ok();
}

#[tokio::test]
async fn sponsor_rejects_wrong_entry_point_end_to_end() {
    let (url, handle) = spawn_server().await;
    let client = reqwest::Client::new();
    let op = sample_op_json("0xabababababababababababababababababababab");
    let wrong_ep = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let resp: serde_json::Value = client
        .post(&url)
        .json(&json!({
            "jsonrpc": "2.0", "id": 1,
            "method": "pm_sponsorUserOperation",
            "params": [op, wrong_ep, 1]
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert!(resp.get("result").is_none());
    assert_eq!(resp["error"]["code"].as_i64().unwrap(), -32602);
    handle.stop().unwrap();
    tokio::time::timeout(Duration::from_secs(2), handle.stopped()).await.ok();
}

// Keep UserOperation/Bytes/U256 imported to avoid unused warnings if tests
// change. They're used via the serde JSON shape indirectly.
#[allow(dead_code)]
fn _touch() {
    let _ = UserOperation {
        sender: Default::default(),
        nonce: U256::zero(),
        init_code: Bytes::default(),
        call_data: Bytes::default(),
        call_gas_limit: U256::zero(),
        verification_gas_limit: U256::zero(),
        pre_verification_gas: U256::zero(),
        max_fee_per_gas: U256::zero(),
        max_priority_fee_per_gas: U256::zero(),
        paymaster_and_data: Bytes::default(),
        signature: Bytes::default(),
    };
}
