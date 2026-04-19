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
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("already queued")]
    AlreadyQueued,
    #[error("prover: {0}")]
    Prover(String),
    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl ResponseError for Error {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::AlreadyQueued => StatusCode::CONFLICT,
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
    fn not_found_is_404() {
        assert_eq!(Error::NotFound.status_code(), StatusCode::NOT_FOUND);
    }
    #[test]
    fn bad_request_is_400() {
        assert_eq!(Error::BadRequest("x".into()).status_code(), StatusCode::BAD_REQUEST);
    }
    #[test]
    fn already_queued_is_409() {
        assert_eq!(Error::AlreadyQueued.status_code(), StatusCode::CONFLICT);
    }
    #[test]
    fn prover_is_500() {
        assert_eq!(Error::Prover("oops".into()).status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }
    #[test]
    fn db_is_500() {
        assert_eq!(
            Error::Db(sqlx::Error::RowNotFound).status_code(),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }
}
