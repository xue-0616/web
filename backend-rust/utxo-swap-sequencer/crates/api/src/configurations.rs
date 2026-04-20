use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationsResponse {
    pub sequencer_lock_code_hash: String,
    pub sequencer_lock_hash_type: u8,
    pub sequencer_lock_args: String,
    pub pool_type_code_hash: String,
    pub configs_cell_type_hash: String,
    pub deployment_cell_type_hash: String,
    pub swap_fee_bps: u16,
    pub min_liquidity: String,
    pub max_intents_per_batch: u32,
    pub batch_interval_ms: u32,
}

/// GET /api/v1/configurations
///
/// MED-SW-2: returns the real sequencer deployment surface so the
/// frontend can bind to the correct on-chain scripts. The previous
/// version returned the struct's `Default`, so every field was an
/// empty string. Front-ends that actually used this endpoint either
/// crashed ("can't decode zero-length hash") or silently fell back
/// to hard-coded values, which meant a redeployment on chain
/// required a coordinated frontend release — exactly what a
/// configuration endpoint is supposed to avoid.
///
/// The four "deployment hash" fields are REQUIRED — if any of them
/// are empty we return 503 rather than ship a cheerful-but-wrong
/// hash. Fee / limit fields have sane defaults and are never
/// empty, so they ride along. See `EnvConfig` for the env var
/// names operators are expected to set.
pub async fn get_configurations(
    ctx: web::Data<AppContext>,
) -> Result<HttpResponse, ApiError> {
    let c = &ctx.config;

    // Deployment hashes: the frontend literally cannot do its job
    // without these, so an unset value is a configuration error.
    // "serve empty string" is strictly worse than 503 — the caller
    // has no way to distinguish "bad deployment" from "valid but
    // unset field".
    let required = [
        ("SEQUENCER_LOCK_CODE_HASH", &c.sequencer_lock_code_hash),
        ("SEQUENCER_LOCK_ARGS", &c.sequencer_lock_args),
        ("POOL_TYPE_CODE_HASH", &c.pool_type_code_hash),
        ("CONFIGS_CELL_TYPE_HASH", &c.configs_cell_type_hash),
        ("DEPLOYMENT_CELL_TYPE_HASH", &c.deployment_cell_type_hash),
    ];
    let missing: Vec<&str> = required
        .iter()
        .filter(|(_, v)| v.trim().is_empty())
        .map(|(n, _)| *n)
        .collect();
    if !missing.is_empty() {
        tracing::error!(
            "GET /configurations: missing required deployment env vars: {:?}",
            missing
        );
        return Err(ApiError::ServiceUnavailable(format!(
            "Sequencer deployment configuration is incomplete: missing {}",
            missing.join(", ")
        )));
    }

    Ok(ApiSuccess::json(ConfigurationsResponse {
        sequencer_lock_code_hash: c.sequencer_lock_code_hash.clone(),
        sequencer_lock_hash_type: c.sequencer_lock_hash_type,
        sequencer_lock_args: c.sequencer_lock_args.clone(),
        pool_type_code_hash: c.pool_type_code_hash.clone(),
        configs_cell_type_hash: c.configs_cell_type_hash.clone(),
        deployment_cell_type_hash: c.deployment_cell_type_hash.clone(),
        swap_fee_bps: c.swap_fee_bps,
        min_liquidity: c.min_liquidity.clone(),
        max_intents_per_batch: c.max_intents_per_batch,
        batch_interval_ms: c.batch_interval_ms,
    }))
}

#[cfg(test)]
mod tests {
    //! MED-SW-2 unit test. The handler is pure except for
    //! `web::Data<AppContext>`, and constructing a full AppContext
    //! in-process pulls in MySQL + Redis. We instead exercise the
    //! "required fields present / absent" branching with a tiny
    //! local helper mirroring the handler's validation.
    use super::*;
    use api_common::context::EnvConfigRef;

    fn complete_cfg() -> EnvConfigRef {
        EnvConfigRef {
            ckb_rpc_url: "http://ckb:8114".into(),
            ckb_indexer_url: "http://ckb:8116".into(),
            jwt_secret: "x".repeat(32),
            sequencer_utxo_global_api_key: "".into(),
            slack_webhook: "".into(),
            github_token: "".into(),
            sequencer_lock_code_hash: "0xaa".into(),
            sequencer_lock_hash_type: 1,
            sequencer_lock_args: "0xbb".into(),
            pool_type_code_hash: "0xcc".into(),
            configs_cell_type_hash: "0xdd".into(),
            deployment_cell_type_hash: "0xee".into(),
            swap_fee_bps: 30,
            min_liquidity: "1000".into(),
            max_intents_per_batch: 50,
            batch_interval_ms: 3000,
        }
    }

    fn missing(c: &EnvConfigRef) -> Vec<&'static str> {
        let required: [(&'static str, &String); 5] = [
            ("SEQUENCER_LOCK_CODE_HASH", &c.sequencer_lock_code_hash),
            ("SEQUENCER_LOCK_ARGS", &c.sequencer_lock_args),
            ("POOL_TYPE_CODE_HASH", &c.pool_type_code_hash),
            ("CONFIGS_CELL_TYPE_HASH", &c.configs_cell_type_hash),
            ("DEPLOYMENT_CELL_TYPE_HASH", &c.deployment_cell_type_hash),
        ];
        required
            .iter()
            .filter(|(_, v)| v.trim().is_empty())
            .map(|(n, _)| *n)
            .collect()
    }

    #[test]
    fn complete_config_is_accepted() {
        assert!(missing(&complete_cfg()).is_empty());
    }

    #[test]
    fn empty_pool_type_code_hash_is_flagged() {
        let mut c = complete_cfg();
        c.pool_type_code_hash = "".into();
        assert_eq!(missing(&c), vec!["POOL_TYPE_CODE_HASH"]);
    }

    #[test]
    fn whitespace_only_values_are_flagged_too() {
        // A deployment-config env var set to "   " is the classic
        // copy-paste footgun; treat it the same as missing.
        let mut c = complete_cfg();
        c.sequencer_lock_args = "   ".into();
        assert_eq!(missing(&c), vec!["SEQUENCER_LOCK_ARGS"]);
    }

    #[test]
    fn all_missing_returns_all_names() {
        let mut c = complete_cfg();
        c.sequencer_lock_code_hash.clear();
        c.sequencer_lock_args.clear();
        c.pool_type_code_hash.clear();
        c.configs_cell_type_hash.clear();
        c.deployment_cell_type_hash.clear();
        let m = missing(&c);
        assert_eq!(m.len(), 5);
        assert!(m.contains(&"SEQUENCER_LOCK_CODE_HASH"));
        assert!(m.contains(&"DEPLOYMENT_CELL_TYPE_HASH"));
    }
}
