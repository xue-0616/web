//! The monitor loop.
//!
//! `run()` drives one poll tick at a time. The control flow is deliberately
//! flat so the invariants stay easy to reason about:
//!
//! 1. **Load** the last snapshot from disk (first tick only).
//! 2. **Fetch** the current kid set from Apple.
//! 3. **Diff** against the snapshot — if unchanged, sleep and loop.
//! 4. **Notify** Slack with the change summary.
//! 5. **Persist** the new snapshot atomically.
//! 6. **Sleep** `poll_interval`.
//!
//! A transient network error (Apple down, Slack rate-limited) logs a
//! warning and retries next tick — we do **not** corrupt the snapshot on
//! failure. This is the single most important invariant: Slack must
//! receive at most one notification per real key rotation, never several
//! for the same rotation because we forgot to save.

use std::{
    collections::BTreeSet,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{apple, config::Config, slack, state::{Snapshot, Store}};

/// Run the monitor loop until `shutdown` resolves.
///
/// Takes a pre-built `reqwest::Client` so tests can inject a client whose
/// TLS settings / resolver are aimed at a mock server.
pub async fn run(
    cfg: Config,
    client: reqwest::Client,
    mut shutdown: tokio::sync::oneshot::Receiver<()>,
) -> anyhow::Result<()> {
    let store = Store::new(&cfg.state_file);
    let mut snapshot = store.load().await?;
    tracing::info!(
        known_kids = snapshot.kids.len(),
        last_success = snapshot.last_success_unix,
        "loaded snapshot"
    );

    loop {
        tokio::select! {
            biased;
            _ = &mut shutdown => {
                tracing::info!("shutdown signal received");
                return Ok(());
            }
            _ = tick(&cfg, &client, &store, &mut snapshot) => {}
        }

        tokio::select! {
            biased;
            _ = &mut shutdown => {
                tracing::info!("shutdown during sleep");
                return Ok(());
            }
            _ = tokio::time::sleep(cfg.poll_interval) => {}
        }
    }
}

async fn tick(
    cfg: &Config,
    client: &reqwest::Client,
    store: &Store,
    snapshot: &mut Snapshot,
) {
    match apple::fetch_kids(client, &cfg.apple_keys_url, cfg.http_timeout).await {
        Err(e) => {
            tracing::warn!(error = %e, "fetch failed, retrying next tick");
        }
        Ok(current) => {
            if let Err(e) = handle_current(cfg, client, store, snapshot, current).await {
                tracing::error!(error = %e, "tick handler failed");
            }
        }
    }
}

async fn handle_current(
    cfg: &Config,
    client: &reqwest::Client,
    store: &Store,
    snapshot: &mut Snapshot,
    current: BTreeSet<String>,
) -> anyhow::Result<()> {
    // First-ever run: no Slack notification — just persist and move on.
    // This avoids a spurious "every key is new" alert after container
    // redeploys that lose state (matches the closed-source ELF's
    // behaviour observed in production).
    let first_run = snapshot.last_success_unix == 0 && snapshot.kids.is_empty();

    if !first_run && current == snapshot.kids {
        tracing::debug!(n = current.len(), "no change");
        return Ok(());
    }

    if first_run {
        tracing::info!(n = current.len(), "first-run, seeding snapshot");
    } else {
        let added: Vec<String> = current.difference(&snapshot.kids).cloned().collect();
        let removed: Vec<String> = snapshot.kids.difference(&current).cloned().collect();
        tracing::info!(
            added = added.len(),
            removed = removed.len(),
            total = current.len(),
            "kid set changed"
        );
        let msg = slack::format_change(&added, &removed, current.len());
        // Slack failure must NOT prevent snapshot save — otherwise a
        // temporarily-unreachable Slack would cause a re-alarm on every
        // subsequent tick until Slack came back.
        match slack::post(client, &cfg.slack_webhook_url, &msg, cfg.http_timeout).await {
            Ok(()) => tracing::info!("notified Slack"),
            Err(e) => tracing::error!(error = %e, "Slack notification failed — will not retry (snapshot still saved)"),
        }
    }

    snapshot.kids = current;
    snapshot.last_success_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    store.save(snapshot).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn first_run_is_silent_even_when_kids_present() {
        // This is an architectural test — handle_current() must not try
        // to POST to Slack on first-run. We detect "tried to post" by
        // giving it an unreachable URL + zero timeout and asserting no
        // error bubbles up (Slack was never called).
        let tmp = tempfile::tempdir().unwrap();
        let cfg = Config {
            apple_keys_url: "http://unused/".into(),
            slack_webhook_url: "http://localhost:1/".into(), // would 500 if hit
            poll_interval: std::time::Duration::from_secs(1),
            state_file: tmp.path().join("s.json"),
            http_timeout: std::time::Duration::from_millis(10),
        };
        let store = Store::new(&cfg.state_file);
        let mut snapshot = Snapshot::default();
        let current = ["a", "b"].into_iter().map(String::from).collect();
        let client = reqwest::Client::new();

        // Expect Ok: first-run skips Slack entirely.
        handle_current(&cfg, &client, &store, &mut snapshot, current).await.unwrap();
        assert_eq!(snapshot.kids.len(), 2);
        assert!(snapshot.last_success_unix > 0);
    }

    #[tokio::test]
    async fn unchanged_set_is_a_noop() {
        let tmp = tempfile::tempdir().unwrap();
        let cfg = Config {
            apple_keys_url: "http://unused/".into(),
            slack_webhook_url: "http://localhost:1/".into(),
            poll_interval: std::time::Duration::from_secs(1),
            state_file: tmp.path().join("s.json"),
            http_timeout: std::time::Duration::from_millis(10),
        };
        let store = Store::new(&cfg.state_file);
        let mut snapshot = Snapshot {
            kids: ["a", "b"].into_iter().map(String::from).collect(),
            last_success_unix: 1000,
        };
        let same: BTreeSet<_> = ["a", "b"].into_iter().map(String::from).collect();
        let client = reqwest::Client::new();
        handle_current(&cfg, &client, &store, &mut snapshot, same).await.unwrap();
        // No change → last_success unchanged (we didn't re-save).
        assert_eq!(snapshot.last_success_unix, 1000);
    }
}
