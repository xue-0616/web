//! Slack incoming-webhook notifier.
//!
//! The ELF's `slack_webhook_url` field is POSTed a JSON body with a
//! single `text` key — Slack's "simplest" webhook format.

use serde::Serialize;

use crate::{
    error::{Error, Result},
    reconciler::ReconReport,
};

#[derive(Debug, Serialize)]
struct SlackBody<'a> {
    text: &'a str,
}

pub async fn notify(
    client: &reqwest::Client,
    webhook: &str,
    title: &str,
    report: &ReconReport,
) -> Result<()> {
    if !report.is_alerting() {
        return Ok(());
    }
    let text = format_alert(title, report);
    let resp = client
        .post(webhook)
        .json(&SlackBody { text: &text })
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(Error::Slack(format!("slack webhook returned HTTP {status}")));
    }
    Ok(())
}

pub fn format_alert(title: &str, report: &ReconReport) -> String {
    let mut out = String::new();
    out.push_str(":rotating_light: *");
    out.push_str(title);
    out.push_str("*\n");
    out.push_str(&report.summary());
    out.push('\n');
    if !report.missing_on_chain.is_empty() {
        out.push_str("\n*Missing on-chain:*\n");
        for d in &report.missing_on_chain {
            out.push_str(&format!(
                "- `{}` live=`{}`\n",
                d.key,
                d.live_fingerprint.as_deref().unwrap_or("-"),
            ));
        }
    }
    if !report.stale_on_chain.is_empty() {
        out.push_str("\n*Stale on-chain:*\n");
        for d in &report.stale_on_chain {
            out.push_str(&format!(
                "- `{}` live=`{}` chain=`{}`\n",
                d.key,
                d.live_fingerprint.as_deref().unwrap_or("-"),
                d.chain_fingerprint.as_deref().unwrap_or("-"),
            ));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reconciler::{DiffEntry, reconcile};
    use std::collections::BTreeMap;
    use wiremock::{
        matchers::{body_json, method, path},
        Mock, MockServer, ResponseTemplate,
    };

    fn m(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn format_alert_mentions_counts_and_keys() {
        let live = m(&[("gmail.com|20230601", "0xNEW")]);
        let chain = m(&[("gmail.com|20230601", "0xOLD")]);
        let r = reconcile(&live, &chain);
        let s = format_alert("DKIM drift", &r);
        assert!(s.contains("DKIM drift"));
        assert!(s.contains("Stale on-chain"));
        assert!(s.contains("gmail.com|20230601"));
        assert!(s.contains("0xNEW"));
        assert!(s.contains("0xOLD"));
    }

    #[test]
    fn format_alert_sections_are_conditional() {
        let r = ReconReport {
            missing_on_chain: vec![DiffEntry {
                key: "k".into(),
                live_fingerprint: Some("0xaa".into()),
                chain_fingerprint: None,
            }],
            stale_on_chain: vec![],
            ok: vec![],
        };
        let s = format_alert("t", &r);
        assert!(s.contains("Missing on-chain"));
        assert!(!s.contains("Stale on-chain"));
    }

    #[tokio::test]
    async fn notify_skips_non_alerting_report() {
        let server = MockServer::start().await;
        // No mock → any request would fail. Therefore the success of
        // this test *proves* notify() did not fire an HTTP call.
        let r = ReconReport { missing_on_chain: vec![], stale_on_chain: vec![], ok: vec!["x".into()] };
        let client = reqwest::Client::new();
        let url = format!("{}/hook", server.uri());
        notify(&client, &url, "no-op", &r).await.unwrap();
    }

    #[tokio::test]
    async fn notify_posts_on_alert() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/hook"))
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount(&server)
            .await;

        let r = ReconReport {
            missing_on_chain: vec![DiffEntry {
                key: "k".into(),
                live_fingerprint: Some("0xaa".into()),
                chain_fingerprint: None,
            }],
            stale_on_chain: vec![],
            ok: vec![],
        };
        let client = reqwest::Client::new();
        let url = format!("{}/hook", server.uri());
        notify(&client, &url, "test", &r).await.unwrap();
    }

    #[tokio::test]
    async fn notify_posts_text_field() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/hook"))
            .and(wiremock::matchers::body_string_contains("test-title"))
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount(&server)
            .await;

        let r = ReconReport {
            missing_on_chain: vec![DiffEntry {
                key: "k".into(),
                live_fingerprint: Some("0xaa".into()),
                chain_fingerprint: None,
            }],
            stale_on_chain: vec![],
            ok: vec![],
        };
        let client = reqwest::Client::new();
        let url = format!("{}/hook", server.uri());
        notify(&client, &url, "test-title", &r).await.unwrap();
    }

    #[tokio::test]
    async fn notify_non_200_is_slack_error() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/down"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let r = ReconReport {
            missing_on_chain: vec![DiffEntry {
                key: "k".into(),
                live_fingerprint: Some("0xaa".into()),
                chain_fingerprint: None,
            }],
            stale_on_chain: vec![],
            ok: vec![],
        };
        let client = reqwest::Client::new();
        let url = format!("{}/down", server.uri());
        let err = notify(&client, &url, "t", &r).await.unwrap_err();
        assert!(matches!(err, Error::Slack(_)));
    }

    // Intentionally exercise the body_json matcher shape so a future
    // Slack-API change (e.g. requiring `blocks` instead of `text`)
    // forces a test update.
    #[tokio::test]
    async fn notify_body_shape_is_text_field() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/hook"))
            .and(body_json(serde_json::json!({"text": ":rotating_light: *t*\nmissing_on_chain=1 stale_on_chain=0 ok=0\n\n*Missing on-chain:*\n- `k` live=`0xaa`\n"})))
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount(&server)
            .await;

        let r = ReconReport {
            missing_on_chain: vec![DiffEntry {
                key: "k".into(),
                live_fingerprint: Some("0xaa".into()),
                chain_fingerprint: None,
            }],
            stale_on_chain: vec![],
            ok: vec![],
        };
        let client = reqwest::Client::new();
        let url = format!("{}/hook", server.uri());
        notify(&client, &url, "t", &r).await.unwrap();
    }
}
