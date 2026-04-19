/// CKB Explorer API client
/// https://mainnet-api.explorer.nervos.org
pub struct CkbExplorerClient {
    url: String,
    client: reqwest::Client,
}

impl CkbExplorerClient {
    pub fn new(is_mainnet: bool) -> Self {
        let url = if is_mainnet {
            "https://mainnet-api.explorer.nervos.org".to_string()
        } else {
            "https://testnet-api.explorer.nervos.org".to_string()
        };
        Self {
            url,
            client: reqwest::Client::new(),
        }
    }

    /// Get token info by type_hash
    pub async fn get_udt_info(&self, type_hash: &str) -> anyhow::Result<Option<UdtInfo>> {
        let resp = self
            .client
            .get(format!("{}/api/v1/udts/{}", self.url, type_hash))
            .send()
            .await?;

        if resp.status().is_success() {
            let info: UdtInfo = resp.json().await?;
            Ok(Some(info))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct UdtInfo {
    pub symbol: Option<String>,
    pub full_name: Option<String>,
    pub decimal: Option<u8>,
    pub icon_file: Option<String>,
}
