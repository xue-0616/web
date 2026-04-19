//! Substreams endpoint wrapper — holds the tonic gRPC channel, API key, and
//! the connection retry policy. Matches the closed-source
//! `token_price_manager::substreams::SubstreamsEndpoint::new` export.

use std::sync::Arc;

use tonic::{
    metadata::MetadataValue,
    service::{interceptor::InterceptedService, Interceptor},
    transport::{Channel, ClientTlsConfig, Endpoint},
};

use crate::error::DexautoTrackerError;
use crate::pb::sf::substreams::rpc::v2::stream_client::StreamClient;

type RpcStreamClient = StreamClient<InterceptedService<Channel, AuthInterceptor>>;

/// One substreams endpoint + authed gRPC client, safe to clone (Arc-wrapped).
#[derive(Clone)]
pub struct SubstreamsEndpoint {
    pub uri: String,
    pub api_key: Option<String>,
    inner: Arc<RpcStreamClient>,
}

impl SubstreamsEndpoint {
    pub async fn new(uri: String, api_key: Option<String>) -> Result<Self, DexautoTrackerError> {
        let endpoint = build_endpoint(&uri)?;
        let channel = endpoint
            .connect()
            .await
            .map_err(|e| DexautoTrackerError::Substreams(format!("connect: {e}")))?;
        let interceptor = AuthInterceptor {
            api_key: api_key.clone(),
        };
        let client = StreamClient::with_interceptor(channel, interceptor)
            .max_decoding_message_size(256 * 1024 * 1024)
            .max_encoding_message_size(256 * 1024 * 1024)
            .send_compressed(tonic::codec::CompressionEncoding::Gzip)
            .accept_compressed(tonic::codec::CompressionEncoding::Gzip);
        Ok(Self {
            uri,
            api_key,
            inner: Arc::new(client),
        })
    }

    /// Access the underlying authenticated gRPC client. The inner client is
    /// shared; each stream call clones cheaply via tonic's channel multiplex.
    pub fn client(&self) -> RpcStreamClient {
        (*self.inner).clone()
    }

    /// Construct a lazy, never-connected endpoint suitable for tests that
    /// only exercise the pure-compute paths (like `handle_block`). The
    /// channel is built via `connect_lazy()` which never dials the remote
    /// until the first RPC, so tests that don't issue RPCs run against an
    /// entirely in-memory runner.
    ///
    /// Not gated on `#[cfg(test)]` because integration tests under `tests/`
    /// compile against the library without the test cfg flag; marking it
    /// `#[doc(hidden)]` keeps it out of the public API surface instead.
    #[doc(hidden)]
    pub fn lazy_for_tests() -> Self {
        let channel = Endpoint::from_static("http://127.0.0.1:1").connect_lazy();
        let interceptor = AuthInterceptor { api_key: None };
        let client = StreamClient::with_interceptor(channel, interceptor);
        Self {
            uri: "http://127.0.0.1:1".into(),
            api_key: None,
            inner: Arc::new(client),
        }
    }
}

fn build_endpoint(uri: &str) -> Result<Endpoint, DexautoTrackerError> {
    let ep = Endpoint::from_shared(uri.to_string())
        .map_err(|e| DexautoTrackerError::Substreams(format!("bad uri: {e}")))?;
    // Enable TLS if the URI is https/grpcs. With the `tls-roots` feature
    // enabled, the default `ClientTlsConfig` picks up the system's native
    // root certificates automatically.
    let ep = if uri.starts_with("https://") || uri.starts_with("grpcs://") {
        ep.tls_config(ClientTlsConfig::new())
            .map_err(|e| DexautoTrackerError::Substreams(format!("tls: {e}")))?
    } else {
        ep
    };
    Ok(ep
        .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
        .http2_keep_alive_interval(std::time::Duration::from_secs(30))
        .keep_alive_while_idle(true))
}

/// Attaches `x-api-key` and the standard substreams `authorization` header to
/// every outgoing gRPC request.
#[derive(Clone)]
pub struct AuthInterceptor {
    pub api_key: Option<String>,
}

impl Interceptor for AuthInterceptor {
    fn call(
        &mut self,
        mut req: tonic::Request<()>,
    ) -> Result<tonic::Request<()>, tonic::Status> {
        if let Some(key) = &self.api_key {
            let value: MetadataValue<_> = format!("Bearer {key}")
                .parse()
                .map_err(|_| tonic::Status::invalid_argument("bad api key"))?;
            req.metadata_mut().insert("authorization", value);
        }
        Ok(req)
    }
}
