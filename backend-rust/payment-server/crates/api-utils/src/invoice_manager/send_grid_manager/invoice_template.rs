/// SendGrid email templates for invoice notifications

pub fn payment_receipt_template(
    recipient_email: &str,
    amount: &str,
    currency: &str,
    tx_hash: &str,
) -> serde_json::Value {
    serde_json::json!({
        "personalizations": [{"to": [{"email": recipient_email}]}],
        "from": {"email": "noreply@unipass.id"},
        "subject": format!("Payment Receipt - {} {}", amount, currency),
        "content": [{"type": "text/html", "value": format!(
            "<h2>Payment Confirmed</h2><p>Amount: {} {}</p><p>TX: {}</p>",
            amount, currency, tx_hash
        )}]
    })
}
