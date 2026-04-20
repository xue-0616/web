use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateIssueRequest {
    pub title: String,
    pub body: String,
}

/// Maximum title length for GitHub issues
const MAX_TITLE_LENGTH: usize = 256;
/// Maximum body length for GitHub issues
const MAX_BODY_LENGTH: usize = 65535;

/// POST /api/v1/github/issue
///
/// SECURITY (H-6): This endpoint is now behind JWT auth middleware (configured in routes).
/// SECURITY (L-2): GitHub API error details are sanitized before logging.
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<CreateIssueRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = body.into_inner();

    // SECURITY (H-7/L-3): Validate and sanitize input
    if req.title.is_empty() || req.title.len() > MAX_TITLE_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Title must be 1-{} characters", MAX_TITLE_LENGTH
        )));
    }
    if req.body.len() > MAX_BODY_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Body must not exceed {} characters", MAX_BODY_LENGTH
        )));
    }

    // Sanitize title and body — strip control characters except newlines
    let sanitized_title: String = req.title.chars()
        .filter(|c| !c.is_control() || *c == '\n')
        .collect();
    let sanitized_body: String = req.body.chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\r')
        .collect();

    let client = reqwest::Client::new();

    let resp = client
        .post("https://api.github.com/repos/AcmeCrypto/utxoswap-sequencer/issues")
        .header("Authorization", format!("token {}", ctx.config.github_token))
        .header("User-Agent", "utxo-swap-sequencer")
        .json(&serde_json::json!({
            "title": sanitized_title,
            "body": sanitized_body,
        }))
        .send()
        .await
        .map_err(|_e| {
            // SECURITY (L-2): Don't log raw error which may contain token info
            tracing::error!("GitHub API request failed (network error)");
            ApiError::Internal("GitHub API request failed".to_string())
        })?;

    let status = resp.status();

    if status.is_success() {
        Ok(ApiSuccess::json(serde_json::json!({"created": true})))
    } else {
        // SECURITY (L-2): Log sanitized error — don't include response body which may contain token details
        tracing::error!("GitHub API returned error status: {}", status.as_u16());
        Err(ApiError::Internal("GitHub issue creation failed".to_string()))
    }
}
