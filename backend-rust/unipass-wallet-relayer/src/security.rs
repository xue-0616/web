use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::{Error, HttpResponse, body::EitherBody};
use std::collections::HashMap;
use std::future::{ready, Ready};
use std::net::IpAddr;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::Instant;

// ---------------------------------------------------------------------------
// Constant-time comparison (no short-circuit)
// ---------------------------------------------------------------------------
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ===========================================================================
// API Key Authentication Middleware
// ===========================================================================
#[derive(Clone)]
pub struct ApiKeyAuth {
    api_key: Arc<String>,
}

impl ApiKeyAuth {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key: Arc::new(api_key),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for ApiKeyAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = ApiKeyAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(ApiKeyAuthMiddleware {
            service: Arc::new(service),
            api_key: self.api_key.clone(),
        }))
    }
}

pub struct ApiKeyAuthMiddleware<S> {
    service: Arc<S>,
    api_key: Arc<String>,
}

impl<S, B> Service<ServiceRequest> for ApiKeyAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let expected_key = self.api_key.clone();

        Box::pin(async move {
            // Skip auth for health endpoints
            let path = req.path().to_string();
            if path == "/health" {
                let res = svc.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // Fail-closed: if the server was started without an API key
            // configured, reject every request instead of allowing access
            // based on a trivially-matching empty comparison.
            if expected_key.is_empty() {
                let resp = HttpResponse::ServiceUnavailable()
                    .json(serde_json::json!({"error": "Relayer API key not configured"}));
                return Ok(req.into_response(resp).map_into_right_body());
            }

            // Check X-API-Key header
            let provided = req
                .headers()
                .get("X-API-Key")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            if !constant_time_eq(provided.as_bytes(), expected_key.as_bytes()) {
                let resp = HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "Invalid or missing API key"}));
                return Ok(req.into_response(resp).map_into_right_body());
            }

            let res = svc.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

// ===========================================================================
// Simple In-Memory Rate Limiter Middleware
// ===========================================================================
#[derive(Clone)]
pub struct RateLimiter {
    max_requests: u32,
    window_secs: u64,
    state: Arc<Mutex<HashMap<IpAddr, Vec<Instant>>>>,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        let limiter = Self {
            max_requests,
            window_secs,
            state: Arc::new(Mutex::new(HashMap::new())),
        };

        // SECURITY FIX (BUG-21): Spawn background cleanup task to periodically evict expired
        // entries from the in-memory rate limiter. This prevents unbounded memory growth from
        // long-running servers and also logs a startup warning about state loss on restart.
        // For production, consider using Redis-backed rate limiting for persistence across deploys.
        tracing::warn!(
            "Rate limiter is in-memory only. State will be lost on restart. \
             For production, consider Redis-backed rate limiting."
        );
        let cleanup_state = limiter.state.clone();
        let cleanup_window = window_secs;
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(cleanup_window));
                if let Ok(mut map) = cleanup_state.lock() {
                    let now = Instant::now();
                    let window = std::time::Duration::from_secs(cleanup_window);
                    map.retain(|_ip, entries: &mut Vec<Instant>| {
                        entries.retain(|t| now.duration_since(*t) < window);
                        !entries.is_empty()
                    });
                }
            }
        });

        limiter
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = RateLimiterMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RateLimiterMiddleware {
            service: Arc::new(service),
            max_requests: self.max_requests,
            window_secs: self.window_secs,
            state: self.state.clone(),
        }))
    }
}

pub struct RateLimiterMiddleware<S> {
    service: Arc<S>,
    max_requests: u32,
    window_secs: u64,
    state: Arc<Mutex<HashMap<IpAddr, Vec<Instant>>>>,
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let state = self.state.clone();
        let max_requests = self.max_requests;
        let window_secs = self.window_secs;

        let ip = req
            .peer_addr()
            .map(|a| a.ip())
            .unwrap_or_else(|| IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)));

        Box::pin(async move {
            let now = Instant::now();
            let window = std::time::Duration::from_secs(window_secs);

            let allowed = {
                let mut map = state.lock().unwrap_or_else(|e| e.into_inner());
                let entries = map.entry(ip).or_default();
                entries.retain(|t| now.duration_since(*t) < window);
                if entries.len() >= max_requests as usize {
                    false
                } else {
                    entries.push(now);
                    true
                }
            };

            if !allowed {
                let resp = HttpResponse::TooManyRequests()
                    .json(serde_json::json!({"error": "Rate limit exceeded"}));
                return Ok(req.into_response(resp).map_into_right_body());
            }

            let res = svc.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

// ===========================================================================
// Secure Private Key Wrapper — zeroes memory on drop, no Debug/Clone
// ===========================================================================
pub struct SecurePrivateKey {
    inner: Vec<u8>,
}

impl SecurePrivateKey {
    /// Parse a hex private key (with optional 0x prefix).
    /// Validates it is exactly 32 bytes (64 hex chars).
    pub fn from_hex(hex_str: &str) -> Result<Self, String> {
        let stripped = hex_str.strip_prefix("0x").unwrap_or(hex_str);
        if stripped.len() != 64 {
            return Err(format!(
                "Private key must be 64 hex chars (32 bytes), got {} chars",
                stripped.len()
            ));
        }
        if !stripped.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("Private key contains non-hex characters".to_string());
        }
        let bytes = hex::decode(stripped)
            .map_err(|e| format!("Failed to decode private key hex: {}", e))?;
        Ok(Self { inner: bytes })
    }

    /// Access the raw key bytes (use sparingly)
    pub fn as_bytes(&self) -> &[u8] {
        &self.inner
    }

    /// Return the key as 0x-prefixed hex string for passing to ethers
    pub fn to_hex_string(&self) -> String {
        format!("0x{}", hex::encode(&self.inner))
    }
}

impl Drop for SecurePrivateKey {
    fn drop(&mut self) {
        // Zero out the key material
        for byte in self.inner.iter_mut() {
            unsafe {
                std::ptr::write_volatile(byte, 0u8);
            }
        }
    }
}

// Intentionally no Debug or Clone — prevents accidental leaking
impl std::fmt::Debug for SecurePrivateKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecurePrivateKey([REDACTED])")
    }
}
