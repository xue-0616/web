use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpResponse,
    body::EitherBody,
};
use std::{
    collections::HashMap,
    future::{ready, Future, Ready},
    pin::Pin,
    sync::{Arc, Mutex},
    time::Instant,
};

// ──────────────────────────────────────────────────────
// Constant-time byte comparison
// ──────────────────────────────────────────────────────

/// Compare two byte slices without short-circuiting on the first differing
/// byte or on length mismatch, removing timing side-channels that a simple
/// `==` comparison would expose.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    let max = a.len().max(b.len());
    let mut diff = (a.len() ^ b.len()) as u8;
    for i in 0..max {
        let x = *a.get(i).unwrap_or(&0);
        let y = *b.get(i).unwrap_or(&0);
        diff |= x ^ y;
    }
    diff == 0
}

// ──────────────────────────────────────────────────────
// API Key Authentication Middleware
// ──────────────────────────────────────────────────────

/// Extracts the authenticated user identity from the request extensions.
/// Handlers call `req.extensions().get::<AuthenticatedUser>()` after auth middleware runs.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
}

/// Factory that produces `ApiKeyAuthMiddleware` instances.
#[derive(Clone)]
pub struct ApiKeyAuth {
    /// Accepted API key (from environment variable).
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
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = ApiKeyAuthMiddleware<S>;
    type InitError = ();
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
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let expected_key = self.api_key.clone();

        Box::pin(async move {
            // Extract API key from `X-API-Key` header or `Authorization: Bearer <key>`
            let provided_key = req
                .headers()
                .get("X-API-Key")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
                .or_else(|| {
                    req.headers()
                        .get("Authorization")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.strip_prefix("Bearer "))
                        .map(|s| s.to_string())
                });

            let ok = match provided_key.as_deref() {
                Some(k) => constant_time_eq(k.as_bytes(), expected_key.as_bytes()),
                None => false,
            };

            if ok {
                // Insert authenticated user identity into request extensions.
                // For API-key auth the user_id is derived from a header or defaults to "api".
                //
                // SECURITY NOTE: the X-User-Id header is trusted only because this
                // endpoint sits behind a single shared API key intended for internal
                // service-to-service calls. Any client that possesses the API key can
                // impersonate any user via this header. Treat the API key as
                // equivalent to superuser credentials for this service.
                let user_id = req
                    .headers()
                    .get("X-User-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("api")
                    .to_string();
                req.extensions_mut().insert(AuthenticatedUser { user_id });

                let res = service.call(req).await?;
                Ok(res.map_into_left_body())
            } else {
                let response = HttpResponse::Unauthorized()
                    .json(serde_json::json!({
                        "code": -1,
                        "message": "Missing or invalid API key"
                    }));
                Ok(req.into_response(response).map_into_right_body())
            }
        })
    }
}

// ──────────────────────────────────────────────────────
// Simple In-Memory Rate Limiter Middleware
// ──────────────────────────────────────────────────────

/// Sliding-window rate limiter keyed by client IP.
#[derive(Clone)]
pub struct RateLimiter {
    /// Max requests per window.
    max_requests: u32,
    /// Window duration in seconds.
    window_secs: u64,
    state: Arc<Mutex<RateLimiterState>>,
}

struct RateLimiterState {
    /// IP → list of request timestamps within window.
    buckets: HashMap<String, Vec<Instant>>,
    /// Last time we purged stale entries.
    last_cleanup: Instant,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            max_requests,
            window_secs,
            state: Arc::new(Mutex::new(RateLimiterState {
                buckets: HashMap::new(),
                last_cleanup: Instant::now(),
            })),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = RateLimiterMiddleware<S>;
    type InitError = ();
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
    state: Arc<Mutex<RateLimiterState>>,
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let max_requests = self.max_requests;
        let window_secs = self.window_secs;
        let state = self.state.clone();

        Box::pin(async move {
            let client_ip = req
                .connection_info()
                .realip_remote_addr()
                .unwrap_or("unknown")
                .to_string();

            let now = Instant::now();
            let window = std::time::Duration::from_secs(window_secs);

            let allowed = {
                let mut s = state.lock().unwrap();

                // Periodic cleanup: every 60 s, drop stale buckets.
                if now.duration_since(s.last_cleanup) > std::time::Duration::from_secs(60) {
                    s.buckets.retain(|_, ts| {
                        ts.retain(|t| now.duration_since(*t) < window);
                        !ts.is_empty()
                    });
                    s.last_cleanup = now;
                }

                let bucket = s.buckets.entry(client_ip).or_default();
                bucket.retain(|t| now.duration_since(*t) < window);

                if (bucket.len() as u32) < max_requests {
                    bucket.push(now);
                    true
                } else {
                    false
                }
            };

            if allowed {
                let res = service.call(req).await?;
                Ok(res.map_into_left_body())
            } else {
                let response = HttpResponse::TooManyRequests()
                    .json(serde_json::json!({
                        "code": -1,
                        "message": "Rate limit exceeded. Try again later."
                    }));
                Ok(req.into_response(response).map_into_right_body())
            }
        })
    }
}

// ──────────────────────────────────────────────────────
// Input Validation Helpers
// ──────────────────────────────────────────────────────

/// Maximum slippage: 50 % (5000 bps).
pub const MAX_SLIPPAGE_BPS: u16 = 5000;

/// Validate a SolanaSwapRequest and return a human-readable error if invalid.
pub fn validate_swap_request(
    amount_specified: u64,
    slippage_bps: u16,
    max_priority_fee: u64,
    bribery_amount: u64,
) -> Result<(), String> {
    if amount_specified == 0 {
        return Err("amount_specified must be > 0".into());
    }
    if slippage_bps > MAX_SLIPPAGE_BPS {
        return Err(format!(
            "slippage_bps {} exceeds maximum {} (50%)",
            slippage_bps, MAX_SLIPPAGE_BPS,
        ));
    }
    // Guard u64→i64 overflow: values >= 2^63 would wrap to negative in DB.
    const I64_MAX: u64 = i64::MAX as u64;
    if amount_specified > I64_MAX {
        return Err("amount_specified exceeds maximum safe value".into());
    }
    if max_priority_fee > I64_MAX {
        return Err("max_priority_fee exceeds maximum safe value".into());
    }
    if bribery_amount > I64_MAX {
        return Err("bribery_amount exceeds maximum safe value".into());
    }
    Ok(())
}

/// Validate that a string is a valid Solana base58 public key (32 bytes).
/// Returns an error message if invalid. (Audit #19)
pub fn validate_solana_pubkey(field_name: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} must not be empty", field_name));
    }
    match bs58::decode(value).into_vec() {
        Ok(bytes) if bytes.len() == 32 => Ok(()),
        Ok(bytes) => Err(format!(
            "{} decoded to {} bytes, expected 32 (Solana pubkey)",
            field_name, bytes.len()
        )),
        Err(e) => Err(format!("{} is not valid base58: {}", field_name, e)),
    }
}
