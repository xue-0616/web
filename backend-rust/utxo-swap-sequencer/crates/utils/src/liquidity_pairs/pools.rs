use anyhow::Result;
use std::collections::HashMap;

use super::pool::OnChainPoolState;

/// Manage multiple liquidity pools in-memory cache
pub struct Pools {
    pools: HashMap<[u8; 32], OnChainPoolState>,
}

impl Pools {
    pub fn new() -> Self { Self { pools: HashMap::new() } }

    pub fn get(&self, type_hash: &[u8; 32]) -> Option<&OnChainPoolState> {
        self.pools.get(type_hash)
    }

    pub fn get_mut(&mut self, type_hash: &[u8; 32]) -> Option<&mut OnChainPoolState> {
        self.pools.get_mut(type_hash)
    }

    pub fn insert(&mut self, type_hash: [u8; 32], state: OnChainPoolState) {
        self.pools.insert(type_hash, state);
    }
}
