//! actix-web HTTP surface.
//!
//! Endpoints (names from recovered `snap_server` symbols):
//!
//! | Method | Path                            | Auth | Purpose |
//! |--------|---------------------------------|------|---------|
//! | GET    | `/healthz`                      | none | liveness probe |
//! | POST   | `/v1/account/login_challenge`   | none | issue a nonce for a wallet to sign |
//! | POST   | `/v1/account/login`             | none | exchange signed challenge for a JWT |
//! | GET    | `/v1/account/me`                | JWT  | current account |
//! | POST   | `/v1/account/guide_status`      | JWT  | mark onboarding as finished |
//! | POST   | `/v1/tx/prepare`                | JWT  | sign a free_sig for a new tx |
//! | GET    | `/v1/tx/history`                | JWT  | paginated tx history |

use std::sync::Arc;

use actix_web::{
    HttpMessage, HttpRequest, HttpResponse, Responder,
    web::{self, Data, Json, Query, ServiceConfig},
};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{Claims, JwtIssuer},
    common::{GuideStatus, ProviderType},
    config::Config,
    contract::FreeQuotaSigner,
    error::{Error, Result},
};

pub struct AppState {
    pub db: sqlx::MySqlPool,
    pub redis: crate::mq::RedisPool,
    pub config: Arc<Config>,
    pub jwt: Arc<JwtIssuer>,
    pub signer: Arc<FreeQuotaSigner>,
}

pub fn configure(app: &mut ServiceConfig) {
    app.route("/healthz", web::get().to(healthz))
        .service(
            web::scope("/v1/account")
                .route("/login_challenge", web::post().to(login_challenge))
                .route("/login", web::post().to(login))
                .route("/me", web::get().to(me))
                .route("/guide_status", web::post().to(set_guide_status)),
        )
        .service(
            web::scope("/v1/tx")
                .route("/prepare", web::post().to(tx_prepare))
                .route("/history", web::get().to(tx_history)),
        );
}

#[derive(Debug, Serialize)]
pub struct Envelope<T: Serialize> {
    pub code: u16,
    pub data: Option<T>,
}

impl<T: Serialize> Envelope<T> {
    pub fn ok(d: T) -> Self { Self { code: 0, data: Some(d) } }
}

// --------------------------------------------------------------------
// Public endpoints
// --------------------------------------------------------------------

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

#[derive(Debug, Deserialize)]
pub struct LoginChallengeReq {
    pub wallet_address: String,
}

#[derive(Debug, Serialize)]
pub struct LoginChallengeResp {
    pub nonce: String,
    pub ttl_secs: u64,
}

async fn login_challenge(
    state: Data<AppState>,
    Json(req): Json<LoginChallengeReq>,
) -> Result<HttpResponse> {
    let wallet = req.wallet_address.to_ascii_lowercase();
    let _ = parse_evm_address(&wallet)?; // validate shape
    let nonce = random_nonce();
    let ttl_secs = 300;
    crate::mq::put_challenge(&state.redis, &wallet, &nonce, ttl_secs).await?;
    Ok(HttpResponse::Ok().json(Envelope::ok(LoginChallengeResp { nonce, ttl_secs })))
}

#[derive(Debug, Deserialize)]
pub struct LoginReq {
    pub wallet_address: String,
    pub provider_type: ProviderType,
    pub provider_identifier: String,
    /// Hex-encoded 65-byte signature of the most recent challenge.
    pub signature: String,
    pub nonce: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResp {
    pub token: String,
}

async fn login(
    state: Data<AppState>,
    Json(req): Json<LoginReq>,
) -> Result<HttpResponse> {
    let wallet_lower = req.wallet_address.to_ascii_lowercase();
    let wallet_bytes = parse_evm_address(&wallet_lower)?;

    // Atomically fetch + delete the challenge so a signature can't be reused.
    let expected_nonce = crate::mq::take_challenge(&state.redis, &wallet_lower)
        .await?
        .ok_or(Error::Unauthorized)?;
    if expected_nonce != req.nonce {
        return Err(Error::Unauthorized);
    }

    // Ecrecover the signature over the issued challenge and assert the
    // recovered EVM address matches `wallet_address`. See
    // `sigverify::verify_login_signature` for the digest scheme
    // (EIP-191 personal_sign) and negative-path test matrix.
    crate::sigverify::verify_login_signature(&wallet_bytes, &req.nonce, &req.signature)?;

    let account = crate::daos::snap_account::ensure(
        &state.db,
        &wallet_bytes,
        req.provider_type,
        &req.provider_identifier,
    )
    .await?;

    let token = state.jwt.issue(account.id as i64, &wallet_lower, req.provider_type)?;
    Ok(HttpResponse::Ok().json(Envelope::ok(LoginResp { token })))
}

// --------------------------------------------------------------------
// Authed endpoints
// --------------------------------------------------------------------

fn require_claims(req: &HttpRequest, jwt: &JwtIssuer) -> Result<Claims> {
    let header = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(Error::Unauthorized)?;
    let token = header.strip_prefix("Bearer ").ok_or(Error::Unauthorized)?;
    jwt.verify(token)
}

#[derive(Debug, Serialize)]
pub struct MeResp {
    pub account_id: i64,
    pub wallet_address: String,
    pub provider: ProviderType,
}

async fn me(state: Data<AppState>, req: HttpRequest) -> Result<HttpResponse> {
    let claims = require_claims(&req, &state.jwt)?;
    Ok(HttpResponse::Ok().json(Envelope::ok(MeResp {
        account_id: claims.sub,
        wallet_address: claims.wallet,
        provider: claims.provider,
    })))
}

#[derive(Debug, Deserialize)]
pub struct GuideStatusReq {
    pub status: GuideStatus,
}

async fn set_guide_status(
    state: Data<AppState>,
    req: HttpRequest,
    Json(body): Json<GuideStatusReq>,
) -> Result<HttpResponse> {
    let claims = require_claims(&req, &state.jwt)?;
    crate::daos::snap_account::set_guide_status(&state.db, claims.sub as u64, body.status).await?;
    Ok(HttpResponse::Ok().json(Envelope::ok(serde_json::json!({}))))
}

#[derive(Debug, Deserialize)]
pub struct TxPrepareReq {
    pub chain_id: u64,
    pub nonce: u64,
    pub used_free_quota: u32,
    pub effective_time_secs_from_now: u64,
}

#[derive(Debug, Serialize)]
pub struct TxPrepareResp {
    pub free_sig: String,
    pub effective_time: u64,
}

async fn tx_prepare(
    state: Data<AppState>,
    req: HttpRequest,
    Json(body): Json<TxPrepareReq>,
) -> Result<HttpResponse> {
    let claims = require_claims(&req, &state.jwt)?;
    let wallet_bytes = parse_evm_address(&claims.wallet)?;
    let wallet = ethers_core::types::Address::from_slice(&wallet_bytes);

    let effective_time = crate::contract::now_unix() + body.effective_time_secs_from_now;
    let sig_bytes = state
        .signer
        .sign_free_quota(
            body.chain_id,
            wallet,
            body.nonce,
            body.used_free_quota,
            effective_time,
        )
        .await?;
    Ok(HttpResponse::Ok().json(Envelope::ok(TxPrepareResp {
        free_sig: format!("0x{}", hex::encode(&sig_bytes)),
        effective_time,
    })))
}

#[derive(Debug, Deserialize)]
pub struct TxHistoryQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}
fn default_limit() -> i64 { 50 }

async fn tx_history(
    state: Data<AppState>,
    req: HttpRequest,
    Query(q): Query<TxHistoryQuery>,
) -> Result<HttpResponse> {
    let claims = require_claims(&req, &state.jwt)?;
    let wallet = parse_evm_address(&claims.wallet)?;
    let rows = crate::daos::snap_account_transaction::list_for_wallet(
        &state.db, &wallet, q.limit,
    )
    .await?;
    Ok(HttpResponse::Ok().json(Envelope::ok(rows)))
}

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

pub fn parse_evm_address(s: &str) -> Result<[u8; 20]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() != 40 {
        return Err(Error::BadRequest(format!("expected 40 hex, got {}", s.len())));
    }
    let bytes = hex::decode(s).map_err(|e| Error::BadRequest(e.to_string()))?;
    let mut out = [0u8; 20];
    out.copy_from_slice(&bytes);
    Ok(out)
}

fn random_nonce() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    // Simple seeded counter-based nonce. Good enough for a login
    // challenge — entropy only matters against prediction, not brute
    // force, and the challenge is one-shot (GETDEL). For hardened
    // deployments swap in `rand::random::<u128>()`.
    format!("{:032x}", seed)
}

// Prevent actix macro from poisoning HttpMessage import (unused warning guard)
#[allow(dead_code)]
fn _touch(req: &HttpRequest) -> bool {
    req.extensions().contains::<()>()
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test as awtest;

    #[test]
    fn parse_address_round_trip() {
        let out = parse_evm_address("0x0102030405060708090a0b0c0d0e0f1011121314").unwrap();
        assert_eq!(out[0], 0x01);
        assert_eq!(out[19], 0x14);
    }

    #[test]
    fn parse_address_rejects_bad_length() {
        assert!(matches!(parse_evm_address("0xdead"), Err(Error::BadRequest(_))));
    }

    #[test]
    fn parse_address_rejects_non_hex() {
        assert!(matches!(
            parse_evm_address("0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"),
            Err(Error::BadRequest(_))
        ));
    }

    #[test]
    fn nonce_is_non_empty_and_hex() {
        let n = random_nonce();
        assert_eq!(n.len(), 32);
        assert!(n.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[actix_web::test]
    async fn healthz_returns_ok() {
        let app = awtest::init_service(
            actix_web::App::new().route("/healthz", web::get().to(healthz)),
        )
        .await;
        let req = awtest::TestRequest::get().uri("/healthz").to_request();
        let resp = awtest::call_service(&app, req).await;
        assert!(resp.status().is_success());
        let body: serde_json::Value = awtest::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
    }

    #[test]
    fn envelope_ok_shape() {
        let e = Envelope::ok(serde_json::json!({"k": "v"}));
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["code"], 0);
        assert_eq!(v["data"]["k"], "v");
    }
}
