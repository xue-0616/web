/// Slack webhook notification for ERROR alerts.
/// Includes rate limiting to prevent notification flooding.

use anyhow::Result;
use std::sync::atomic::{AtomicU64, Ordering};

/// Minimum interval between Slack notifications in seconds.
const MIN_INTERVAL_SECS: u64 = 30;

static LAST_SENT: AtomicU64 = AtomicU64::new(0);

/// Send a Slack notification. Rate-limited to prevent flooding.
/// Returns Ok(()) if the message was sent or suppressed due to rate limiting.
pub async fn send_slack_message(webhook_url: &str, text: &str) -> Result<()> {
    if webhook_url.is_empty() {
        return Ok(());
    }

    // Rate limiting: don't send more than once per MIN_INTERVAL_SECS
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let last = LAST_SENT.load(Ordering::Relaxed);
    if now - last < MIN_INTERVAL_SECS {
        tracing::debug!("Slack notification rate-limited (last sent {}s ago)", now - last);
        return Ok(());
    }
    LAST_SENT.store(now, Ordering::Relaxed);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let resp = client
        .post(webhook_url)
        .json(&serde_json::json!({"text": text}))
        .send()
        .await?;

    if !resp.status().is_success() {
        tracing::warn!(
            "Slack webhook returned non-success status: {}",
            resp.status()
        );
    }

    Ok(())
}
