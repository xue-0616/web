// Apollo configuration client — reads config from Apollo Config Service

use anyhow::Result;

pub struct ApolloClient {
    base_url: String,
    client: reqwest::Client,
}

impl ApolloClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::new(),
        }
    }
}
