use ethers::types::{Bytes, U256};
use crate::execute_parser::InnerTransaction;

/// Parsed ModuleMain.execute transaction
#[derive(Debug, Clone)]
pub struct ParsedTransaction {
    pub nonce: U256,
    pub signature: Bytes,
    pub inner_txs: Vec<InnerTransaction>,
}
