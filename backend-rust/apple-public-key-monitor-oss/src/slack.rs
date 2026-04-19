//! Slack webhook client.
//!
//! Slack "Incoming Webhooks" accept a JSON body with a `text` field and
//! respond with HTTP 200 + body `"ok"`. On bad payloads they return 400
//! + a descriptive error string (we surface that back up the stack).

use std::time::Duration;

use serde::Serialize;

#[derive(Debug, Serialize)]
struct SlackPayload<'a> {
    text: &'a str,
}

#[derive(Debug, thiserror::Error)]
pub enum SlackError {
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("slack rejected message (status {status}): {body}")]
    Rejected { status: u16, body: String },
}

pub async fn post(
    client: &reqwest::Client,
    webhook: &str,
    text: &str,
    timeout: Duration,
) -> Result<(), SlackError> {
    let resp = client
        .post(webhook)
        .timeout(timeout)
        .json(&SlackPayload { text })
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(SlackError::Rejected {
            status: status.as_u16(),
            body,
        });
    }
    Ok(())
}

/// Format a human-readable change summary for Slack.
///
/// Kept as a free function so we can unit-test it without spinning up an
/// HTTP mock — it's purely a formatter.
pub fn format_change(
    added: &[String],
    removed: &[String],
    current_count: usize,
) -> String {
    let mut parts = Vec::new();
    if !added.is_empty() {
        parts.push(format!(":key: Apple JWKS changes: added {:?}", added));
    }
    if !removed.is_empty() {
        parts.push(format!(":warning: Apple JWKS changes: removed {:?}", removed));
    }
    parts.push(format!(
        "Current kid set size: {current_count}. Endpoint: https://appleid.apple.com/auth/keys"
    ));
    parts.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_change_shows_added() {
        let msg = format_change(
            &["X".to_string(), "Y".to_string()],
            &[],
            2,
        );
        assert!(msg.contains("added"));
        assert!(msg.contains("\"X\""));
        assert!(msg.contains("\"Y\""));
        assert!(msg.contains("Current kid set size: 2"));
        assert!(!msg.contains("removed"));
    }

    #[test]
    fn format_change_shows_removed_only() {
        let msg = format_change(&[], &["old".to_string()], 1);
        assert!(!msg.contains("added"));
        assert!(msg.contains("removed"));
        assert!(msg.contains("\"old\""));
    }

    #[test]
    fn format_change_shows_both() {
        let msg = format_change(
            &["new1".to_string()],
            &["old1".to_string()],
            3,
        );
        assert!(msg.contains("added"));
        assert!(msg.contains("removed"));
    }
}
