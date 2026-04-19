use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChainType {
    CKBMainnet,
    CKBTestnet,
}

impl ChainType {
    pub fn is_mainnet(&self) -> bool {
        matches!(self, Self::CKBMainnet)
    }
}
