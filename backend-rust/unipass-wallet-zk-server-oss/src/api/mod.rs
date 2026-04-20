//! actix-web HTTP surface.
//!
//! Endpoints:
//!
//! | Method | Path                   | Purpose |
//! |--------|------------------------|---------|
//! | GET    | `/healthz`             | liveness |
//! | POST   | `/gen_proof`           | enqueue a new proof job |
//! | GET    | `/gen_proof/{hash}`    | poll a proof result |

use std::sync::Arc;

use actix_web::{
    HttpResponse, Responder,
    web::{self, Data, Json, Path, ServiceConfig},
};
use serde::Serialize;

use crate::{
    config::Config,
    daos::email_proofs,
    error::{Error, Result},
    mq::{self, RedisPool},
    types::{GenProofRequest, ProveStage, ProveTask},
};

pub struct AppState {
    pub db: sqlx::MySqlPool,
    pub redis: RedisPool,
    pub config: Arc<Config>,
}

pub fn configure(app: &mut ServiceConfig) {
    app.route("/healthz", web::get().to(healthz))
        .route("/gen_proof", web::post().to(gen_proof))
        .route("/gen_proof/{header_hash}", web::get().to(get_proof));
}

#[derive(Debug, Serialize)]
pub struct Envelope<T: Serialize> {
    pub code: u16,
    pub data: Option<T>,
}
impl<T: Serialize> Envelope<T> {
    pub fn ok(d: T) -> Self { Self { code: 0, data: Some(d) } }
}

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

#[derive(Debug, Serialize)]
pub struct GenProofResp {
    pub header_hash: String,
    pub stage: ProveStage,
    pub queue_id: Option<String>,
}

async fn gen_proof(
    state: Data<AppState>,
    Json(body): Json<GenProofRequest>,
) -> Result<HttpResponse> {
    // Compute a cheap deterministic hash to dedupe across restarts. In
    // production the prover output's `header_hash` is authoritative;
    // here we only need something that's stable for a given `email`
    // input so the client can poll immediately.
    let header_hash = cheap_header_hash(&body.email);

    // Fast path: if the proof is already in the DB, return "finished"
    // without re-enqueueing.
    if email_proofs::exists(&state.db, &header_hash).await? {
        return Ok(HttpResponse::Ok().json(Envelope::ok(GenProofResp {
            header_hash,
            stage: ProveStage::Finished,
            queue_id: None,
        })));
    }

    let task = ProveTask {
        header_hash: header_hash.clone(),
        email: body.email,
        email_type: body.email_type,
    };
    let queue_id = mq::enqueue(&state.redis, &state.config.task_stream, &task).await?;

    Ok(HttpResponse::Ok().json(Envelope::ok(GenProofResp {
        header_hash,
        stage: ProveStage::Pending,
        queue_id: Some(queue_id),
    })))
}

#[derive(Debug, Serialize)]
pub struct GetProofResp {
    pub stage: ProveStage,
    pub row: Option<email_proofs::EmailProof>,
}

async fn get_proof(
    state: Data<AppState>,
    path: Path<String>,
) -> Result<HttpResponse> {
    let header_hash = path.into_inner();
    if !is_hex_0x_hash(&header_hash) {
        return Err(Error::BadRequest(format!(
            "header_hash must be 0x-prefixed 64-char hex, got {header_hash:?}"
        )));
    }
    let row = email_proofs::find_by_hash(&state.db, &header_hash).await?;
    let stage = match &row {
        Some(r) if r.success => ProveStage::Finished,
        Some(_) => ProveStage::Failed,
        None => ProveStage::Pending,
    };
    Ok(HttpResponse::Ok().json(Envelope::ok(GetProofResp { stage, row })))
}

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------

/// Deterministic, dependency-free "hash" used purely for dedup keying.
/// NOT a cryptographic hash — the real prover outputs a proper
/// keccak256 over the email headers. We accept a weaker function on the
/// API side because the post-prove DB write always uses the prover's
/// own hash (which we overwrite via ON DUPLICATE KEY UPDATE if the
/// cheap hash collides, which in practice never happens for realistic
/// email corpora).
pub fn cheap_header_hash(email: &str) -> String {
    // Split into (djb2, fnv1a, sdbm, length) so the 64-hex output has
    // enough independent components to make real-world collisions
    // astronomically unlikely.
    let mut djb2: u64 = 5381;
    let mut fnv1a: u64 = 0xcbf29ce484222325;
    let mut sdbm: u64 = 0;
    for b in email.bytes() {
        djb2 = djb2.wrapping_mul(33).wrapping_add(b as u64);
        fnv1a ^= b as u64;
        fnv1a = fnv1a.wrapping_mul(0x100000001b3);
        sdbm = (b as u64).wrapping_add(sdbm.wrapping_shl(6)).wrapping_add(sdbm.wrapping_shl(16)).wrapping_sub(sdbm);
    }
    let len = email.len() as u64;
    format!("0x{djb2:016x}{fnv1a:016x}{sdbm:016x}{len:016x}")
}

pub fn is_hex_0x_hash(s: &str) -> bool {
    let stripped = match s.strip_prefix("0x") {
        Some(r) => r,
        None => return false,
    };
    stripped.len() == 64 && stripped.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test as awtest;

    #[test]
    fn cheap_hash_is_deterministic_and_shaped() {
        let a = cheap_header_hash("hello");
        let b = cheap_header_hash("hello");
        assert_eq!(a, b);
        assert!(is_hex_0x_hash(&a));
    }

    #[test]
    fn cheap_hash_differs_per_input() {
        assert_ne!(cheap_header_hash("a"), cheap_header_hash("b"));
    }

    #[test]
    fn is_hex_hash_rejects_missing_prefix() {
        assert!(!is_hex_0x_hash(&"a".repeat(64)));
    }

    #[test]
    fn is_hex_hash_rejects_wrong_length() {
        assert!(!is_hex_0x_hash("0xdeadbeef"));
    }

    #[test]
    fn is_hex_hash_rejects_non_hex() {
        let mut s = "0x".to_string();
        s.push_str(&"z".repeat(64));
        assert!(!is_hex_0x_hash(&s));
    }

    #[test]
    fn is_hex_hash_accepts_proper() {
        let s = format!("0x{}", "a".repeat(64));
        assert!(is_hex_0x_hash(&s));
    }

    #[actix_web::test]
    async fn healthz_returns_ok() {
        let app = awtest::init_service(
            actix_web::App::new().route("/healthz", web::get().to(healthz)),
        ).await;
        let req = awtest::TestRequest::get().uri("/healthz").to_request();
        let resp = awtest::call_service(&app, req).await;
        assert!(resp.status().is_success());
        let body: serde_json::Value = awtest::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
    }

    #[test]
    fn envelope_ok_shape() {
        let e = Envelope::ok(serde_json::json!({"k":"v"}));
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["code"], 0);
        assert_eq!(v["data"]["k"], "v");
    }
}
