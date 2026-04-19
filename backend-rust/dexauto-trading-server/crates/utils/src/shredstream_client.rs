use anyhow::Result;
use tokio::sync::mpsc;
use std::collections::HashSet;
use std::sync::{Arc, RwLock};

/// ShredStream gRPC endpoint (local sidecar proxy)
/// Run jito-shredstream-proxy with --grpc-service-port to enable
const DEFAULT_SHREDSTREAM_ENDPOINT: &str = "http://127.0.0.1:9999";

/// A pre-confirmation swap detected from shred entries
#[derive(Debug, Clone)]
pub struct PreConfirmSwap {
    pub slot: u64,
    pub trader: String,
    pub token_mint: String,
    pub side: SwapSide,
    pub lamports_value: u64,
    pub detected_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SwapSide {
    Buy,
    Sell,
}

/// ShredStream client that connects to a local jito-shredstream-proxy gRPC
/// service and parses shred entries for monitored smart money addresses.
///
/// Architecture:
///   Solana Leaders → Jito ShredStream Proxy (UDP shreds → decoded entries)
///     → This client (gRPC subscribe) → parse for monitored addresses
///     → emit PreConfirmSwap signals 200-500ms before gRPC/RPC confirmation
///
/// Requires running jito-shredstream-proxy as a sidecar:
///   jito-shredstream-proxy shredstream \
///     --block-engine-url https://mainnet.block-engine.jito.wtf \
///     --auth-keypair keypair.json \
///     --desired-regions tokyo \
///     --dest-ip-ports 127.0.0.1:8001 \
///     --grpc-service-port 9999
pub struct ShredStreamClient {
    endpoint: String,
    monitored_addresses: Arc<RwLock<HashSet<String>>>,
    signal_tx: mpsc::UnboundedSender<PreConfirmSwap>,
}

impl ShredStreamClient {
    pub fn new(
        endpoint: Option<&str>,
        signal_tx: mpsc::UnboundedSender<PreConfirmSwap>,
    ) -> Self {
        Self {
            endpoint: endpoint
                .unwrap_or(DEFAULT_SHREDSTREAM_ENDPOINT)
                .to_string(),
            monitored_addresses: Arc::new(RwLock::new(HashSet::new())),
            signal_tx,
        }
    }

    pub fn update_monitored_addresses(&self, addresses: Vec<String>) {
        let mut set = self.monitored_addresses.write().unwrap();
        set.clear();
        for addr in addresses {
            set.insert(addr);
        }
        tracing::info!("ShredStream monitoring {} addresses", set.len());
    }

    pub fn add_monitored_address(&self, address: String) {
        self.monitored_addresses.write().unwrap().insert(address);
    }

    /// Start the ShredStream subscription loop.
    /// Connects to the local shredstream-proxy gRPC, subscribes to entries,
    /// and parses each entry's transactions for monitored address activity.
    ///
    /// This runs in a background tokio task and automatically reconnects.
    pub async fn run(&self) -> Result<()> {
        tracing::info!("Connecting to ShredStream proxy at {}", self.endpoint);

        loop {
            match self.subscribe_loop().await {
                Ok(()) => {
                    tracing::warn!("ShredStream stream ended, reconnecting in 2s...");
                }
                Err(e) => {
                    tracing::error!("ShredStream error: {}, reconnecting in 5s...", e);
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }

    async fn subscribe_loop(&self) -> Result<()> {
        // Connect to shredstream-proxy gRPC
        // The proxy exposes ShredstreamProxyClient::subscribe_entries()
        // which streams decoded Solana entries (Vec<Entry>) per slot
        //
        // Since we can't import jito_protos directly without adding the dep,
        // we use tonic to connect to the raw gRPC service.
        let channel = tonic::transport::Channel::from_shared(self.endpoint.clone())?
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(std::time::Duration::from_secs(300))
            .connect()
            .await?;

        tracing::info!("ShredStream gRPC connected");

        // Use the raw gRPC streaming endpoint
        // ShredstreamProxy/SubscribeEntries returns stream of SlotEntry { slot, entries }
        let mut client = tonic::client::Grpc::new(channel);
        client.ready().await?;

        let request = tonic::Request::new(());
        let response = client
            .server_streaming(
                request,
                tonic::codegen::http::uri::PathAndQuery::from_static(
                    "/shredstream.ShredstreamProxy/SubscribeEntries",
                ),
                tonic::codec::ProstCodec::default(),
            )
            .await?;

        let mut stream: tonic::Streaming<prost_types::Any> = response.into_inner();

        while let Some(msg) = stream.message().await? {
            // msg is raw bytes — SlotEntry proto { slot: u64, entries: bytes }
            // We parse the slot and entries from the proto message
            self.process_slot_entry(msg).await;
        }

        Ok(())
    }

    async fn process_slot_entry(&self, entry: impl prost::Message) {
        // Decode entries from the slot entry protobuf
        // Each entry contains transactions that we scan for monitored addresses
        //
        // In production, this would:
        // 1. bincode::deserialize entries into Vec<solana_entry::entry::Entry>
        // 2. For each transaction, extract account keys
        // 3. Check if any account key is in our monitored set
        // 4. If match found, parse the swap details and emit PreConfirmSwap
        //
        // Placeholder implementation — requires jito_protos and solana_entry deps
        let _ = entry;
    }

    /// Parse a raw transaction from shred entries for DEX swap activity.
    /// Checks if any account key matches our monitored smart money addresses.
    fn try_parse_swap(
        &self,
        slot: u64,
        tx_accounts: &[String],
        _tx_data: &[u8],
    ) -> Option<PreConfirmSwap> {
        let monitored = self.monitored_addresses.read().unwrap();

        // Find the monitored trader in this transaction's account list
        let trader = tx_accounts.iter().find(|a| monitored.contains(a.as_str()))?;

        // Known DEX program IDs for swap detection
        let dex_programs: HashSet<&str> = [
            "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM V4
            "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
            "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",  // Orca Whirlpool
            "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  // Jupiter V6
            "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  // Pump.fun
        ].into_iter().collect();

        // Check if this tx interacts with a known DEX
        let has_dex = tx_accounts.iter().any(|a| dex_programs.contains(a.as_str()));
        if !has_dex {
            return None;
        }

        // Determine buy/sell side from token flow direction
        // WSOL (So11111111111111111111111111111111111111112)
        // If WSOL decreases → buy (spending SOL for token)
        // If WSOL increases → sell (receiving SOL from token)
        // Simplified: position 0 is usually signer (trader)
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Extract token mint from account list (heuristic: first non-system, non-DEX account)
        let system_programs: HashSet<&str> = [
            "11111111111111111111111111111111",
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
            "So11111111111111111111111111111111111111112",
            "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
            "ComputeBudget111111111111111111111111111111",
        ].into_iter().collect();

        let token_mint = tx_accounts.iter()
            .find(|a| !system_programs.contains(a.as_str()) && !dex_programs.contains(a.as_str()) && a.as_str() != trader.as_str())
            .cloned()
            .unwrap_or_default();

        Some(PreConfirmSwap {
            slot,
            trader: trader.clone(),
            token_mint,
            side: SwapSide::Buy, // Default — full parsing requires instruction data decode
            lamports_value: 0,
            detected_at_ms: now_ms,
        })
    }
}

/// Start ShredStream client as a background task.
/// Returns the signal receiver for consuming PreConfirmSwap events.
pub fn start_shredstream(
    endpoint: Option<&str>,
    initial_addresses: Vec<String>,
) -> (Arc<ShredStreamClient>, mpsc::UnboundedReceiver<PreConfirmSwap>) {
    let (tx, rx) = mpsc::unbounded_channel();
    let client = Arc::new(ShredStreamClient::new(endpoint, tx));
    client.update_monitored_addresses(initial_addresses);

    let client_clone = Arc::clone(&client);
    tokio::spawn(async move {
        if let Err(e) = client_clone.run().await {
            tracing::error!("ShredStream client fatal error: {}", e);
        }
    });

    (client, rx)
}
