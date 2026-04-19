use actix_web::{web, App, HttpServer, HttpRequest, HttpResponse};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use lindell::sign::ProtocolState;

// ======================== Shared application state ========================

struct AppState {
    /// Active protocol sessions, keyed by UUID.
    /// Each entry stores (ProtocolState, created_at) for timeout enforcement.
    sessions: Mutex<HashMap<String, (ProtocolState, Instant)>>,
    /// Validated configuration.
    config: config_crate::Config,
}

// ======================== Request helpers ========================

/// Every authenticated endpoint receives at least a `session_id`.
#[derive(Deserialize)]
struct SessionBody {
    session_id: String,
    /// Catch-all for protocol-specific fields forwarded to the lindell crate.
    #[serde(flatten)]
    extra: serde_json::Value,
}

/// Constant-time API-key comparison (length-independent timing).
/// Uses SHA-256 hashing to normalize input lengths before comparison,
/// eliminating any timing leak from differing key lengths.
fn verify_api_key(req: &HttpRequest, state: &web::Data<AppState>) -> Result<(), HttpResponse> {
    let provided = req
        .headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !verify_api_key_ct(&state.config.api_key, provided) {
        return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error":"invalid api key"})));
    }
    Ok(())
}

/// Hash-then-compare to avoid length leak. Both inputs are hashed to the same
/// 32-byte length before constant-time comparison.
fn verify_api_key_ct(expected: &str, provided: &str) -> bool {
    use sha2::{Sha256, Digest};
    let expected_hash = Sha256::digest(expected.as_bytes());
    let provided_hash = Sha256::digest(provided.as_bytes());
    let mut diff = 0u8;
    for (a, b) in expected_hash.iter().zip(provided_hash.iter()) {
        diff |= a ^ b;
    }
    diff == 0
}

fn err_json(status: u16, msg: &str) -> HttpResponse {
    let resp = serde_json::json!({"error": msg});
    match status {
        400 => HttpResponse::BadRequest().json(resp),
        404 => HttpResponse::NotFound().json(resp),
        409 => HttpResponse::Conflict().json(resp),
        _ => HttpResponse::InternalServerError().json(resp),
    }
}

// ======================== Handlers ========================

/// Health check — unauthenticated.
async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

/// KeyGen Phase 1 — creates a new session + commitment.
/// No `session_id` required; one is generated and returned.
async fn keygen_first(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> HttpResponse {
    if let Err(e) = verify_api_key(&req, &state) { return e; }

    let session_id = uuid::Uuid::new_v4().to_string();

    let (response, proto_state) = match lindell::sign::keygen_phase1() {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("keygen phase 1 internal error: {}", e);
            return err_json(500, "Internal server error");
        }
    };

    state.sessions.lock().unwrap_or_else(|e| e.into_inner())
        .insert(session_id.clone(), (proto_state, Instant::now()));

    tracing::info!(session_id = %session_id, "keygen phase 1 complete");

    HttpResponse::Ok().json(serde_json::json!({
        "session_id": session_id,
        "data": response,
    }))
}

/// KeyGen Phase 2 — verify Party2 DLog proof, decommit, Paillier setup.
async fn keygen_second(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(e) = verify_api_key(&req, &state) { return e; }

    let parsed: SessionBody = match serde_json::from_value(body.into_inner()) {
        Ok(v) => v,
        Err(e) => return err_json(400, &e.to_string()),
    };

    let prev = {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        match sessions.remove(&parsed.session_id) {
            Some((s, created_at)) => {
                if Instant::now().duration_since(created_at).as_secs() >= state.config.session_timeout_secs {
                    return err_json(409, "session expired");
                }
                s
            }
            None => return err_json(404, "session not found"),
        }
    };

    let (response, new_state) = match lindell::sign::keygen_phase2(prev, &parsed.extra) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("keygen phase 2 internal error: {}", e);
            return err_json(500, "Internal server error");
        }
    };

    state.sessions.lock().unwrap_or_else(|e| e.into_inner())
        .insert(parsed.session_id.clone(), (new_state, Instant::now()));

    tracing::info!(session_id = %parsed.session_id, "keygen phase 2 complete");

    HttpResponse::Ok().json(serde_json::json!({
        "session_id": parsed.session_id,
        "data": response,
    }))
}

/// KeyGen Phase 3 — PDL proof, finalize key generation.
async fn keygen_third(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(e) = verify_api_key(&req, &state) { return e; }

    let parsed: SessionBody = match serde_json::from_value(body.into_inner()) {
        Ok(v) => v,
        Err(e) => return err_json(400, &e.to_string()),
    };

    let prev = {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        match sessions.remove(&parsed.session_id) {
            Some((s, created_at)) => {
                if Instant::now().duration_since(created_at).as_secs() >= state.config.session_timeout_secs {
                    return err_json(409, "session expired");
                }
                s
            }
            None => return err_json(404, "session not found"),
        }
    };

    let (response, new_state) = match lindell::sign::keygen_phase3(prev) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("keygen phase 3 internal error: {}", e);
            return err_json(500, "Internal server error");
        }
    };

    state.sessions.lock().unwrap_or_else(|e| e.into_inner())
        .insert(parsed.session_id.clone(), (new_state, Instant::now()));

    tracing::info!(session_id = %parsed.session_id, "keygen phase 3 complete — key ready");

    HttpResponse::Ok().json(serde_json::json!({
        "session_id": parsed.session_id,
        "data": response,
    }))
}

/// Sign Phase 1 — generate ephemeral R1 + EC-DDH proof.
async fn sign_first(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(e) = verify_api_key(&req, &state) { return e; }

    let parsed: SessionBody = match serde_json::from_value(body.into_inner()) {
        Ok(v) => v,
        Err(e) => return err_json(400, &e.to_string()),
    };

    let prev = {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        match sessions.remove(&parsed.session_id) {
            Some((s, created_at)) => {
                if Instant::now().duration_since(created_at).as_secs() >= state.config.session_timeout_secs {
                    return err_json(409, "session expired");
                }
                s
            }
            None => return err_json(404, "session not found"),
        }
    };

    let (response, new_state) = match lindell::sign::sign_phase1(prev) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("sign phase 1 internal error: {}", e);
            return err_json(500, "Internal server error");
        }
    };

    state.sessions.lock().unwrap_or_else(|e| e.into_inner())
        .insert(parsed.session_id.clone(), (new_state, Instant::now()));

    tracing::info!(session_id = %parsed.session_id, "sign phase 1 complete");

    HttpResponse::Ok().json(serde_json::json!({
        "session_id": parsed.session_id,
        "data": response,
    }))
}

/// Sign Phase 2 — verify Party2 ephemeral, compute final ECDSA signature.
async fn sign_second(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(e) = verify_api_key(&req, &state) { return e; }

    let parsed: SessionBody = match serde_json::from_value(body.into_inner()) {
        Ok(v) => v,
        Err(e) => return err_json(400, &e.to_string()),
    };

    let prev = {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        match sessions.remove(&parsed.session_id) {
            Some((s, created_at)) => {
                if Instant::now().duration_since(created_at).as_secs() >= state.config.session_timeout_secs {
                    return err_json(409, "session expired");
                }
                s
            }
            None => return err_json(404, "session not found"),
        }
    };

    let (response, new_state) = match lindell::sign::sign_phase2(prev, &parsed.extra) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("sign phase 2 internal error: {}", e);
            return err_json(500, "Internal server error");
        }
    };

    // Put the session back (Ready state — can sign again)
    state.sessions.lock().unwrap_or_else(|e| e.into_inner())
        .insert(parsed.session_id.clone(), (new_state, Instant::now()));

    tracing::info!(session_id = %parsed.session_id, "sign phase 2 complete — signature returned");

    HttpResponse::Ok().json(serde_json::json!({
        "session_id": parsed.session_id,
        "data": response,
    }))
}

// ======================== Entry point ========================

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config_crate::Config::from_env()?;
    let bind_address = config.bind_address.clone();
    let port = config.port;
    let worker_count = config.worker_count;

    tracing::info!(
        "Starting tss-ecdsa-server on {}:{} with {} workers",
        bind_address, port, worker_count
    );

    let app_state = web::Data::new(AppState {
        sessions: Mutex::new(HashMap::new()),
        config,
    });

    // Background reaper task: remove sessions older than session_timeout_secs every 30s.
    {
        let sessions_for_reaper = app_state.clone();
        let timeout = app_state.config.session_timeout_secs;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                let mut map = sessions_for_reaper.sessions.lock().unwrap_or_else(|e| e.into_inner());
                let before = map.len();
                let now = Instant::now();
                map.retain(|_id, (_, created_at)| now.duration_since(*created_at).as_secs() < timeout);
                let reaped = before - map.len();
                if reaped > 0 {
                    tracing::info!("Session reaper: removed {} expired session(s)", reaped);
                }
            }
        });
    }

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .route("/health", web::get().to(health))
            .route("/keygen/first", web::post().to(keygen_first))
            .route("/keygen/second", web::post().to(keygen_second))
            .route("/keygen/third", web::post().to(keygen_third))
            .route("/sign/first", web::post().to(sign_first))
            .route("/sign/second", web::post().to(sign_second))
    })
    .workers(worker_count)
    .bind((bind_address.as_str(), port))?
    .run()
    .await?;
    Ok(())
}
