use actix_web::{HttpResponse, http::StatusCode};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Internal: {0}")]
    Internal(String),
    /// Returned when an API endpoint is reachable but the feature it
    /// fronts is deliberately disabled (e.g. HIGH-FM-3 fail-closed gate).
    /// Maps to HTTP 503.
    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
}

impl actix_web::ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(ErrorResponse {
            error: self.to_string(),
        })
    }
}

impl From<sea_orm::DbErr> for ApiError {
    fn from(e: sea_orm::DbErr) -> Self { Self::Internal(e.to_string()) }
}

#[derive(Serialize)]
pub struct ErrorResponse { pub error: String }

#[derive(Serialize)]
pub struct ApiSuccess<T: Serialize> { pub data: T }

impl<T: Serialize> ApiSuccess<T> {
    pub fn json(data: T) -> HttpResponse {
        HttpResponse::Ok().json(Self { data })
    }
}
