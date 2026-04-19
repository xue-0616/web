//! Outbound-tx signer + broadcaster.
//!
//! For each `OutboundTransaction` in state `prepared`:
//! 1. Pick a free signer from the chain's `SubmitterInfo.signers` pool
//!    (round-robin, skipping signers with stuck txs).
//! 2. Query the nonce via ethers provider (`getTransactionCount(pending)`).
//! 3. Query gas price; cap at `OutboundChainInfo.max_gas_price`.
//! 4. RLP-encode the tx and send to the custody wallet for signing
//!    (`POST /transactions/sign`), OR sign locally with the private key
//!    if the signer is in-process (`submitter_infos.signers` is a raw
//!    hex key).
//! 5. Broadcast via `eth_sendRawTransaction`.
//! 6. Mark `status='submitted'` + persist tx_hash.
//! 7. Watch for receipt; on confirmation, call `mark_confirmed`.
//!
//! Fallback: if the destination chain RPC says `nonce too low`, fetch
//! the latest pending nonce and retry.
//!
//! TODO(oss): implement — `submitter` in the ELF has 6 symbols, but the
//! logic depends on whether signing is local or custody-mediated.

use super::{Context, Shutdown};

pub async fn run(_ctx: Context, mut shutdown: Shutdown) {
    tracing::info!("submitter started");
    loop {
        tokio::select! {
            biased;
            _ = shutdown.changed() => {
                tracing::info!("submitter shutdown");
                return;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(5)) => {
                tracing::debug!("submitter tick — stub");
            }
        }
    }
}
