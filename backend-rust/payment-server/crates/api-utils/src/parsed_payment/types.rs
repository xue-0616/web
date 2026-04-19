/// Parsed payment types
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedPaymentOutput {
    pub to: String,
    pub token: Option<String>,
    pub amount: String,
}
