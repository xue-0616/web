use ethers::signers::Signer;

/// NoSignSigner — a dummy signer that produces zero-value (r=0, s=0) signatures.
///
/// # Purpose
/// This signer is intended **exclusively** for gas estimation and transaction simulation,
/// where the smart account wallet validates via ModuleGuest and does not require a real
/// cryptographic signature. The zero signature satisfies the type system but carries no
/// cryptographic validity.
///
/// # Security Warning (BUG-18)
/// **DO NOT** use this signer for actual on-chain transaction submission. The zero
/// signatures it produces will either be rejected by the chain or, worse, could be
/// replayed. It should only be used in estimation/simulation code paths.
///
/// If this signer is accidentally used in a production code path, a warning will be
/// logged on every sign operation to aid in debugging.
#[derive(Debug, Clone)]
pub struct NoSignSigner {
    address: ethers::types::Address,
    chain_id: u64,
}

impl NoSignSigner {
    pub fn new(address: ethers::types::Address, chain_id: u64) -> Self {
        tracing::warn!(
            "NoSignSigner instantiated for address {:?} on chain {} — \
             this signer produces zero signatures and must only be used for estimation/simulation",
            address,
            chain_id
        );
        Self { address, chain_id }
    }
}

#[async_trait::async_trait]
impl Signer for NoSignSigner {
    type Error = ethers::signers::WalletError;

    async fn sign_message<S: Send + Sync + AsRef<[u8]>>(&self, _message: S) -> Result<ethers::types::Signature, Self::Error> {
        // BUG-18 fix: Log warning when zero signature is produced
        tracing::warn!(
            "NoSignSigner::sign_message called for {:?} — returning zero signature (estimation only)",
            self.address
        );
        Ok(ethers::types::Signature { r: ethers::types::U256::zero(), s: ethers::types::U256::zero(), v: 27 })
    }

    async fn sign_transaction(&self, _tx: &ethers::types::transaction::eip2718::TypedTransaction) -> Result<ethers::types::Signature, Self::Error> {
        // BUG-18 fix: Log warning when zero signature is produced
        tracing::warn!(
            "NoSignSigner::sign_transaction called for {:?} — returning zero signature (estimation only)",
            self.address
        );
        Ok(ethers::types::Signature { r: ethers::types::U256::zero(), s: ethers::types::U256::zero(), v: 27 })
    }

    fn address(&self) -> ethers::types::Address { self.address }
    fn chain_id(&self) -> u64 { self.chain_id }
    fn with_chain_id<T: Into<u64>>(mut self, chain_id: T) -> Self {
        self.chain_id = chain_id.into();
        self
    }
}
