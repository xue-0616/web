/// ModuleGuest execute call types
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestExecuteCall {
    pub to: [u8; 20],
    pub value: String,
    pub data: Vec<u8>,
}
