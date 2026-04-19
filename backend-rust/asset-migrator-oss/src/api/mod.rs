//! actix-web HTTP surface.
//!
//! Three endpoint categories (matching the closed-source ELF's
//! `/app/crates/api/src/context.rs` public surface):
//!
//! | Route                        | Method | Use |
//! |------------------------------|--------|-----|
//! | `/healthz`                   | GET    | liveness probe |
//! | `/config`                    | GET    | `PublicConfig` (secrets stripped) |
//! | `/deposit_address/bind`      | POST   | allocate + bind a deposit addr to a wallet |
//! | `/activity/{wallet}`         | GET    | recent `tx_activity` rows for a wallet |

use std::sync::Arc;

use actix_web::{
    HttpResponse, Responder,
    web::{self, Data, Json, Path as WebPath, ServiceConfig},
};
use serde::{Deserialize, Serialize};

use crate::{
    config::AssetMigratorConfigs,
    daos::tx_activity,
    error::{Error, Result},
    services::deposit_address::DepositAddressService,
};

/// Shared state injected into every handler via `Data`.
pub struct AppState {
    pub db: sqlx::MySqlPool,
    pub config: Arc<AssetMigratorConfigs>,
    pub deposit_addresses: Arc<DepositAddressService>,
}

pub fn configure(app: &mut ServiceConfig) {
    app.route("/healthz", web::get().to(healthz))
        .route("/config", web::get().to(public_config))
        .route("/deposit_address/bind", web::post().to(bind_deposit_address))
        .route("/activity/{wallet}", web::get().to(wallet_activity));
}

/// The response envelope the closed-source ELF used: `{ success, result,
/// errorCode, errorMessage }` (from `struct AssetMigratorServicesResponse
/// with 4 elements`).
#[derive(Debug, Serialize)]
pub struct Envelope<T: Serialize> {
    pub success: bool,
    pub result: Option<T>,
    pub error_code: Option<u16>,
    pub error_message: Option<String>,
}

impl<T: Serialize> Envelope<T> {
    pub fn ok(v: T) -> Self {
        Self { success: true, result: Some(v), error_code: None, error_message: None }
    }
}

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status":"ok"}))
}

async fn public_config(state: Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(Envelope::ok(state.config.public()))
}

#[derive(Debug, Deserialize)]
pub struct BindRequest {
    pub chain_name: String,
    /// 0x-prefixed 20-byte EVM address.
    pub wallet_address: String,
}

#[derive(Debug, Serialize)]
pub struct BindResponse {
    pub address: String,
}

async fn bind_deposit_address(
    state: Data<AppState>,
    Json(req): Json<BindRequest>,
) -> Result<HttpResponse> {
    let addr_bytes = parse_evm_address(&req.wallet_address)?;
    let address = state
        .deposit_addresses
        .bind_wallet(&req.chain_name, addr_bytes)
        .await?;
    Ok(HttpResponse::Ok().json(Envelope::ok(BindResponse { address })))
}

async fn wallet_activity(
    state: Data<AppState>,
    wallet: WebPath<String>,
) -> Result<HttpResponse> {
    let addr = parse_evm_address(&wallet)?;
    let rows = tx_activity::list_for_wallet(&state.db, &addr, 50).await?;
    Ok(HttpResponse::Ok().json(Envelope::ok(rows)))
}

pub fn parse_evm_address(s: &str) -> Result<[u8; 20]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() != 40 {
        return Err(Error::BadRequest(format!(
            "expected 40 hex chars after 0x, got {}",
            s.len()
        )));
    }
    let bytes = hex::decode(s)
        .map_err(|e| Error::BadRequest(format!("invalid hex: {e}")))?;
    let mut out = [0u8; 20];
    out.copy_from_slice(&bytes);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test as awtest;

    #[test]
    fn parse_evm_address_accepts_prefixed() {
        let out = parse_evm_address("0x0102030405060708090a0b0c0d0e0f1011121314").unwrap();
        assert_eq!(out[0], 0x01);
        assert_eq!(out[19], 0x14);
    }

    #[test]
    fn parse_evm_address_accepts_unprefixed() {
        let out = parse_evm_address("0102030405060708090a0b0c0d0e0f1011121314").unwrap();
        assert_eq!(out.len(), 20);
    }

    #[test]
    fn parse_evm_address_rejects_short() {
        assert!(matches!(
            parse_evm_address("0xabcd"),
            Err(Error::BadRequest(_))
        ));
    }

    #[test]
    fn parse_evm_address_rejects_non_hex() {
        assert!(matches!(
            parse_evm_address("0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"),
            Err(Error::BadRequest(_))
        ));
    }

    #[actix_web::test]
    async fn healthz_returns_200_with_status_ok() {
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
    fn envelope_ok_sets_success_true() {
        let env = Envelope::ok("hello");
        let j = serde_json::to_value(&env).unwrap();
        assert_eq!(j["success"], true);
        assert_eq!(j["result"], "hello");
        assert!(j["error_code"].is_null());
    }
}
