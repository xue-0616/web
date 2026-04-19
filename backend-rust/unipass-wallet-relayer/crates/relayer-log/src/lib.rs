pub mod slack_webhook_writer;

/// Send alert to Slack webhook
pub async fn send_slack_alert(webhook_url: &str, message: &str) -> anyhow::Result<()> {
    if webhook_url.is_empty() { return Ok(()); }
    let client = reqwest::Client::new();
    client.post(webhook_url)
        .json(&serde_json::json!({"text": message}))
        .send()
        .await?;
    Ok(())
}
