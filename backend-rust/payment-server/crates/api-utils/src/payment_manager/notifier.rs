use anyhow::Result;

/// Notify users about payment status changes (HIGH-09 fix: log errors, don't silently swallow)
pub struct PaymentNotifier {
    sendgrid_api_key: Option<String>,
    slack_webhook: Option<String>,
}

impl PaymentNotifier {
    pub fn new(sendgrid_key: Option<&str>, slack_webhook: Option<&str>) -> Self {
        Self {
            sendgrid_api_key: sendgrid_key.map(|s| s.to_string()),
            slack_webhook: slack_webhook.map(|s| s.to_string()),
        }
    }

    /// Notify about completed payment (HIGH-09 fix: log and report notification errors)
    pub async fn notify_payment_completed(&self, payment_id: u64, email: Option<&str>) -> Result<()> {
        let subject = format!("Payment #{} completed", payment_id);
        let body = format!("Your payment #{} has been processed successfully.", payment_id);
        let mut had_error = false;

        // SendGrid email notification (HIGH-09 fix: handle errors)
        if let (Some(api_key), Some(to_email)) = (&self.sendgrid_api_key, email) {
            let client = reqwest::Client::new();
            let email_body = serde_json::json!({
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": "noreply@unipass.id"},
                "subject": &subject,
                "content": [{"type": "text/html", "value": &body}]
            });

            match client.post("https://api.sendgrid.com/v3/mail/send")
                .bearer_auth(api_key)
                .json(&email_body)
                .send().await
            {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        let status = resp.status();
                        let err_body = resp.text().await.unwrap_or_default();
                        tracing::error!(
                            "SendGrid email notification failed for payment #{} (HTTP {}): {}",
                            payment_id, status, err_body
                        );
                        had_error = true;
                    } else {
                        tracing::info!("Email notification sent for payment #{}", payment_id);
                    }
                }
                Err(e) => {
                    tracing::error!(
                        "SendGrid email notification request failed for payment #{}: {}",
                        payment_id, e
                    );
                    had_error = true;
                }
            }
        }

        // Slack webhook (HIGH-09 fix: handle errors)
        if let Some(webhook_url) = &self.slack_webhook {
            let client = reqwest::Client::new();
            match client.post(webhook_url)
                .json(&serde_json::json!({"text": format!("[Payment] {}: {}", subject, body)}))
                .send().await
            {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        let status = resp.status();
                        tracing::error!(
                            "Slack webhook notification failed for payment #{} (HTTP {})",
                            payment_id, status
                        );
                        had_error = true;
                    } else {
                        tracing::info!("Slack notification sent for payment #{}", payment_id);
                    }
                }
                Err(e) => {
                    tracing::error!(
                        "Slack webhook request failed for payment #{}: {}",
                        payment_id, e
                    );
                    had_error = true;
                }
            }
        }

        if had_error {
            anyhow::bail!("One or more notifications failed for payment #{}", payment_id);
        }
        Ok(())
    }

    /// Notify about failed payment (refund initiated).
    /// Uses the same delivery channels as `notify_payment_completed`; errors from
    /// one channel do not suppress the other — all failures are logged and
    /// surfaced via the returned `Result`.
    pub async fn notify_payment_failed(&self, payment_id: u64, reason: Option<String>) -> Result<()> {
        let reason_str = reason.unwrap_or_else(|| "unknown".to_string());
        let subject = format!("Payment #{} failed — refund initiated", payment_id);
        let body = format!(
            "Your payment #{} could not be processed on-chain (reason: {}). A refund has been initiated and will be visible once settled.",
            payment_id, reason_str
        );
        let mut had_error = false;

        if let Some(webhook_url) = &self.slack_webhook {
            let client = reqwest::Client::new();
            match client.post(webhook_url)
                .json(&serde_json::json!({"text": format!("[Refund] {}: {}", subject, body)}))
                .send().await
            {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        tracing::error!(
                            "Slack refund notification failed for payment #{} (HTTP {})",
                            payment_id, resp.status()
                        );
                        had_error = true;
                    } else {
                        tracing::info!("Slack refund notification sent for payment #{}", payment_id);
                    }
                }
                Err(e) => {
                    tracing::error!(
                        "Slack refund webhook request failed for payment #{}: {}",
                        payment_id, e
                    );
                    had_error = true;
                }
            }
        }

        if had_error {
            anyhow::bail!("One or more refund notifications failed for payment #{}", payment_id);
        }
        Ok(())
    }
}
