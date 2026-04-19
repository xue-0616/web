use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Maximum number of tracked IPs to prevent memory exhaustion attacks.
/// If this limit is reached, new IPs are rejected with 429 until existing entries expire.
const MAX_TRACKED_IPS: usize = 100_000;

/// Simple in-memory sliding window rate limiter.
/// For production, use Redis-based rate limiting for distributed deployments.
pub struct RateLimiter {
    /// Map of key -> (window_start, request_count)
    windows: Mutex<HashMap<String, (Instant, u32)>>,
    /// Maximum requests per window
    max_requests: u32,
    /// Window duration in seconds
    window_secs: u64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
            max_requests,
            window_secs,
        }
    }

    /// Check if a request from the given key is allowed.
    /// Returns Ok(remaining) or Err(retry_after_secs).
    pub fn check(&self, key: &str) -> Result<u32, u64> {
        let mut windows = self.windows.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        let window_duration = std::time::Duration::from_secs(self.window_secs);

        // Evict expired entries periodically when nearing capacity
        if windows.len() > MAX_TRACKED_IPS / 2 {
            windows.retain(|_, (start, _)| now.duration_since(*start) < window_duration);
        }

        // If at capacity after eviction, reject new keys to prevent memory exhaustion
        if !windows.contains_key(key) && windows.len() >= MAX_TRACKED_IPS {
            return Err(self.window_secs);
        }

        let entry = windows.entry(key.to_string()).or_insert((now, 0));

        // If window has expired, reset
        if now.duration_since(entry.0) >= window_duration {
            *entry = (now, 0);
        }

        if entry.1 >= self.max_requests {
            let elapsed = now.duration_since(entry.0).as_secs();
            let retry_after = self.window_secs.saturating_sub(elapsed);
            return Err(retry_after);
        }

        entry.1 += 1;
        Ok(self.max_requests - entry.1)
    }
}

/// Pre-configured rate limiters for different endpoint categories
pub struct RateLimiters {
    /// Login: 5 requests/minute per IP
    pub login: RateLimiter,
    /// Registration: 3 requests/minute per IP
    pub registration: RateLimiter,
    /// Payment: 10 requests/minute per user
    pub payment: RateLimiter,
    /// Webhooks: 100 requests/minute per IP
    pub webhook: RateLimiter,
    /// General: 60 requests/minute per IP
    pub general: RateLimiter,
}

impl RateLimiters {
    pub fn new() -> Self {
        Self {
            login: RateLimiter::new(5, 60),
            registration: RateLimiter::new(3, 60),
            payment: RateLimiter::new(10, 60),
            webhook: RateLimiter::new(100, 60),
            general: RateLimiter::new(60, 60),
        }
    }
}

impl Default for RateLimiters {
    fn default() -> Self {
        Self::new()
    }
}

/// Extract client IP from request using the actual TCP connection address.
/// NOTE: X-Forwarded-For is NOT used because it can be spoofed by clients.
/// If deployed behind a verified reverse proxy, configure the proxy to set a
/// trusted header and update this function to read it instead.
pub fn get_client_ip(req: &actix_web::HttpRequest) -> String {
    req.peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}
