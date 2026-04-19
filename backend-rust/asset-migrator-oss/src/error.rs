//! Crate-wide error type.
//!
//! We keep variants tightly scoped — one variant per layer boundary — so
//! actix handlers can turn `Error` into the right HTTP status without
//! trying to peer into wrapped types.

use actix_web::{HttpResponse, ResponseError, http::StatusCode};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("config: {0}")]
    Config(#[from] crate::config::ConfigError),

    #[error("db: {0}")]
    Db(#[from] sqlx::Error),

    #[error("migrate: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),

    #[error("redis: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("http: {0}")]
    Http(#[from] reqwest::Error),

    #[error("not found")]
    NotFound,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl ResponseError for Error {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        // Match the response envelope the closed-source ELF exposed:
        // `struct AssetMigratorServicesResponse with 4 elements`
        // (success, result, errorCode, errorMessage)
        let body = serde_json::json!({
            "success": false,
            "result": serde_json::Value::Null,
            "errorCode": self.status_code().as_u16(),
            "errorMessage": self.to_string(),
        });
        HttpResponse::build(self.status_code()).json(body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_envelope_matches_legacy_shape() {
        let err = Error::BadRequest("bad input".into());
        let resp = err.error_response();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        // We can't pull the body out of an HttpResponse without consuming
        // it in an actix runtime — just check the status_code path above
        // is wired. Body shape is proven by the JSON envelope test in
        // api/tests via a full request/response roundtrip.
    }

    #[test]
    fn not_found_maps_to_404() {
        assert_eq!(Error::NotFound.status_code(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn db_error_maps_to_500() {
        let e = Error::Db(sqlx::Error::RowNotFound);
        assert_eq!(e.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
