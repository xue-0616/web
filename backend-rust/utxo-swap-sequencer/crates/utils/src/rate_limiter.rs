//! SECURITY (H-3): Per-IP rate limiting middleware for intent submission endpoints
//!
//! Uses a sliding window counter stored in-memory with periodic cleanup.
//! For production, consider upgrading to Redis-based rate limiting for multi-instance support.

use actix_web::{
    body::EitherBody,
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse,
};
use std::collections::HashMap;
use std::future::{ready, Future, Ready};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// SECURITY: Maximum number of tracked IPs to prevent memory exhaustion
const MAX_TRACKED_IPS: usize = 100_000;

/// Rate limiter configuration
#[derive(Clone)]
pub struct RateLimiter {
    /// Maximum requests per window
    max_requests: u32,
    /// Window duration
    window: Duration,
    /// Shared state
    state: Arc<Mutex<RateLimiterState>>,
}

struct RateLimiterState {
    /// Map of IP -> (request_count, window_start)
    counters: HashMap<String, (u32, Instant)>,
    /// Last cleanup time
    last_cleanup: Instant,
}

impl RateLimiter {
    /// Create a new rate limiter
    /// `max_requests`: maximum number of requests per window
    /// `window`: time window for the rate limit
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            max_requests,
            window,
            state: Arc::new(Mutex::new(RateLimiterState {
                counters: HashMap::new(),
                last_cleanup: Instant::now(),
            })),
        }
    }

    /// Check if a request from the given IP should be allowed
    fn check_rate_limit(&self, ip: &str) -> bool {
        let mut state = self.state.lock().unwrap();

        // Periodic cleanup of expired entries (every 60s)
        if state.last_cleanup.elapsed() > Duration::from_secs(60) {
            let now = Instant::now();
            state.counters.retain(|_, (_, start)| now.duration_since(*start) < self.window);
            state.last_cleanup = now;
        }

        // SECURITY: Prevent memory exhaustion by limiting tracked IPs
        if state.counters.len() >= MAX_TRACKED_IPS && !state.counters.contains_key(ip) {
            // Evict expired entries aggressively before rejecting
            let now = Instant::now();
            state.counters.retain(|_, (_, start)| now.duration_since(*start) < self.window);
            if state.counters.len() >= MAX_TRACKED_IPS {
                tracing::warn!("Rate limiter: MAX_TRACKED_IPS ({}) reached, rejecting new IP", MAX_TRACKED_IPS);
                return false;
            }
        }

        let now = Instant::now();
        let entry = state.counters.entry(ip.to_string()).or_insert((0, now));

        // Reset window if expired
        if now.duration_since(entry.1) >= self.window {
            *entry = (0, now);
        }

        entry.0 += 1;
        entry.0 <= self.max_requests
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
            limiter: self.clone(),
        }))
    }
}

pub struct RateLimiterMiddleware<S> {
    service: Arc<S>,
    limiter: RateLimiter,
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
        _ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        std::task::Poll::Ready(Ok(()))
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let limiter = self.limiter.clone();

        Box::pin(async move {
            // SECURITY: Use peer_addr() only to prevent X-Forwarded-For spoofing
            let ip = req
                .peer_addr()
                .map(|addr| addr.ip().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            if limiter.check_rate_limit(&ip) {
                let res = service.call(req).await?;
                Ok(res.map_into_left_body())
            } else {
                tracing::warn!("Rate limit exceeded for IP: {}", ip);
                let resp = HttpResponse::TooManyRequests()
                    .json(serde_json::json!({
                        "success": false,
                        "error": "Rate limit exceeded. Please try again later."
                    }));
                Ok(req.into_response(resp).map_into_right_body())
            }
        })
    }
}
