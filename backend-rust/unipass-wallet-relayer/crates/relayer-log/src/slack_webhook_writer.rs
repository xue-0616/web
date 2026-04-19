// Custom tracing layer that sends ERROR level logs to Slack

use anyhow::Result;

pub async fn send_slack_message(webhook_url: &str, text: &str) -> Result<()> {
    let client = reqwest::Client::new();
    client.post(webhook_url)
        .json(&serde_json::json!({"text": text}))
        .send()
        .await?;
    Ok(())
}
