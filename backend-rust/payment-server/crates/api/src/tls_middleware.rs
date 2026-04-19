/// FINDING-19: X-Forwarded-Proto check utility.
/// In production (behind a reverse proxy/LB), verify that the original request used HTTPS.
/// Call this at the start of sensitive handlers or use as a middleware check.

/// Returns true if the request was made over HTTPS (or if not in production mode).
/// Checks the X-Forwarded-Proto header set by reverse proxies.
pub fn is_https(req: &actix_web::HttpRequest) -> bool {
    // Check X-Forwarded-Proto header (set by load balancers/reverse proxies)
    if let Some(proto) = req.headers().get("X-Forwarded-Proto").and_then(|v| v.to_str().ok()) {
        return proto.eq_ignore_ascii_case("https");
    }

    // If no forwarded header, check the connection info scheme
    let conn_info = req.connection_info();
    conn_info.scheme() == "https"
}

/// Reject non-HTTPS requests in production.
/// Returns None if OK, or Some(HttpResponse) with a 403 error if not HTTPS.
pub fn require_https(req: &actix_web::HttpRequest) -> Option<actix_web::HttpResponse> {
    // Only enforce in production (check ENVIRONMENT env var)
    let is_production = std::env::var("ENVIRONMENT")
        .map(|e| e.eq_ignore_ascii_case("production") || e.eq_ignore_ascii_case("prod"))
        .unwrap_or(false);

    if is_production && !is_https(req) {
        Some(actix_web::HttpResponse::Forbidden().json(serde_json::json!({
            "error": "HTTPS is required in production",
            "message": "This endpoint requires a secure connection."
        })))
    } else {
        None
    }
}
