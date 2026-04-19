//! Crate-wide error type + actix ResponseError bridge.

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
    #[error("jwt: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("unauthorized")]
    Unauthorized,
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl ResponseError for Error {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Unauthorized | Self::Jwt(_) => StatusCode::UNAUTHORIZED,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Conflict(_) => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let body = serde_json::json!({
            "code": self.status_code().as_u16(),
            "message": self.to_string(),
        });
        HttpResponse::build(self.status_code()).json(body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unauthorized_maps_to_401() {
        assert_eq!(Error::Unauthorized.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn not_found_maps_to_404() {
        assert_eq!(Error::NotFound.status_code(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn bad_request_maps_to_400() {
        assert_eq!(Error::BadRequest("x".into()).status_code(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn conflict_maps_to_409() {
        assert_eq!(Error::Conflict("dup".into()).status_code(), StatusCode::CONFLICT);
    }

    #[test]
    fn db_error_maps_to_500() {
        assert_eq!(
            Error::Db(sqlx::Error::RowNotFound).status_code(),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }
}
