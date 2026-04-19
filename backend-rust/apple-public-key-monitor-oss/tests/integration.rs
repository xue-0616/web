//! End-to-end: spin up two `wiremock` servers — one pretending to be Apple,
//! one pretending to be Slack — drive a single tick of the runner, verify:
//!
//! 1. On first-run, the snapshot is seeded but Slack is NOT called.
//! 2. When Apple's kid set changes, Slack is called once with the expected
//!    change summary.
//! 3. When Apple's kid set is unchanged, Slack is not called and the
//!    state file is not rewritten.

use std::{sync::Arc, time::Duration};

use tempfile::TempDir;
use wiremock::{
    matchers::{body_json_string, body_string_contains, method, path},
    Mock, MockServer, ResponseTemplate,
};

use apple_public_key_monitor_oss::{
    apple, config::Config, runner,
    slack as slack_fmt,
    state::Store,
};

fn mk_cfg(apple_url: &str, slack_url: &str, state_file: std::path::PathBuf) -> Config {
    Config {
        apple_keys_url: apple_url.into(),
        slack_webhook_url: slack_url.into(),
        poll_interval: Duration::from_millis(50),
        state_file,
        http_timeout: Duration::from_secs(2),
    }
}

fn jwks(kids: &[&str]) -> String {
    let keys: Vec<_> = kids
        .iter()
        .map(|k| serde_json::json!({"kty": "RSA", "kid": k, "alg": "RS256", "n": "x", "e": "AQAB"}))
        .collect();
    serde_json::json!({ "keys": keys }).to_string()
}

async fn run_one_tick(cfg: &Config) {
    let client = reqwest::Client::new();
    let (_tx, rx) = tokio::sync::oneshot::channel::<()>();

    // Spawn the runner, then shoot shutdown after a brief window. This is
    // enough for exactly one tick because `poll_interval` is 50ms and the
    // first select arm is biased toward shutdown.
    let cfg_clone = cfg.clone();
    let task = tokio::spawn(async move {
        // Wait 200ms then drop rx to signal shutdown.
        tokio::time::sleep(Duration::from_millis(200)).await;
        drop(rx);
    });
    let (tx2, rx2) = tokio::sync::oneshot::channel::<()>();
    let runner_task = tokio::spawn(async move {
        runner::run(cfg_clone, client, rx2).await
    });
    tokio::time::sleep(Duration::from_millis(150)).await;
    let _ = tx2.send(());
    let _ = tokio::time::timeout(Duration::from_secs(2), runner_task).await;
    let _ = task.await;
}

#[tokio::test]
async fn first_run_seeds_without_notifying() {
    let apple_srv = MockServer::start().await;
    let slack_srv = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/auth/keys"))
        .respond_with(ResponseTemplate::new(200).set_body_string(jwks(&["k1", "k2"])))
        .mount(&apple_srv)
        .await;

    // Slack endpoint is registered but we expect ZERO hits.
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_string("ok"))
        .expect(0)
        .mount(&slack_srv)
        .await;

    let tmp = TempDir::new().unwrap();
    let cfg = mk_cfg(
        &format!("{}/auth/keys", apple_srv.uri()),
        &format!("{}/webhook", slack_srv.uri()),
        tmp.path().join("state.json"),
    );
    run_one_tick(&cfg).await;

    // Snapshot must be persisted with both kids.
    let store = Store::new(tmp.path().join("state.json"));
    let snap = store.load().await.unwrap();
    assert_eq!(snap.kids.len(), 2);
    assert!(snap.kids.contains("k1"));
    assert!(snap.kids.contains("k2"));
    assert!(snap.last_success_unix > 0);
}

#[tokio::test]
async fn change_triggers_slack_notification() {
    let apple_srv = MockServer::start().await;
    let slack_srv = MockServer::start().await;

    // Apple returns k1+k2. Previously seen: k1 only (pre-seeded snapshot).
    Mock::given(method("GET"))
        .and(path("/auth/keys"))
        .respond_with(ResponseTemplate::new(200).set_body_string(jwks(&["k1", "k2"])))
        .mount(&apple_srv)
        .await;
    Mock::given(method("POST"))
        .and(body_string_contains("added"))
        .and(body_string_contains("k2"))
        .respond_with(ResponseTemplate::new(200).set_body_string("ok"))
        .expect(1)
        .mount(&slack_srv)
        .await;

    let tmp = TempDir::new().unwrap();
    let state_file = tmp.path().join("state.json");
    // Seed the snapshot so the run is NOT treated as first-run.
    let seed = apple_public_key_monitor_oss::state::Snapshot {
        kids: ["k1".to_string()].into_iter().collect(),
        last_success_unix: 1,
    };
    Store::new(&state_file).save(&seed).await.unwrap();

    let cfg = mk_cfg(
        &format!("{}/auth/keys", apple_srv.uri()),
        &format!("{}/webhook", slack_srv.uri()),
        state_file.clone(),
    );
    run_one_tick(&cfg).await;

    // Verify the updated snapshot has both kids.
    let snap = Store::new(&state_file).load().await.unwrap();
    assert_eq!(snap.kids.len(), 2);
    assert!(snap.kids.contains("k2"));
}

#[tokio::test]
async fn unchanged_set_does_not_call_slack() {
    let apple_srv = MockServer::start().await;
    let slack_srv = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/auth/keys"))
        .respond_with(ResponseTemplate::new(200).set_body_string(jwks(&["k1", "k2"])))
        .mount(&apple_srv)
        .await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_string("ok"))
        .expect(0)
        .mount(&slack_srv)
        .await;

    let tmp = TempDir::new().unwrap();
    let state_file = tmp.path().join("state.json");
    // Pre-seed matching the Apple response exactly.
    let seed = apple_public_key_monitor_oss::state::Snapshot {
        kids: ["k1", "k2"].into_iter().map(String::from).collect(),
        last_success_unix: 100,
    };
    Store::new(&state_file).save(&seed).await.unwrap();

    let cfg = mk_cfg(
        &format!("{}/auth/keys", apple_srv.uri()),
        &format!("{}/webhook", slack_srv.uri()),
        state_file.clone(),
    );
    run_one_tick(&cfg).await;

    // last_success_unix must remain at its old value (no re-save).
    let snap = Store::new(&state_file).load().await.unwrap();
    assert_eq!(snap.last_success_unix, 100);
}

// Keep `body_json_string` import used to avoid dead-code warnings if we
// later expand the test suite without this matcher.
#[allow(dead_code)]
fn _touch() {
    let _ = body_json_string(String::new());
    let _ = Arc::new(());
    let _ = slack_fmt::format_change(&[], &[], 0);
    let _ = apple::Jwk { kid: String::new() };
}
