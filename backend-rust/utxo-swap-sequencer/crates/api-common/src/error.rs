use actix_web::{HttpResponse, ResponseError};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Database error: {0}")]
    Database(#[from] sea_orm::DbErr),
    #[error("Redis error: {0}")]
    Redis(String),
    #[error("CKB RPC error: {0}")]
    CkbRpc(String),
    #[error("Intent error: {0}")]
    IntentError(String),
    #[error("Pool error: {0}")]
    PoolError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    error: String,
}

impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        let (status, message) = match self {
            ApiError::BadRequest(msg) => (actix_web::http::StatusCode::BAD_REQUEST, msg.clone()),
            ApiError::NotFound(msg) => (actix_web::http::StatusCode::NOT_FOUND, msg.clone()),
            ApiError::Unauthorized(msg) => {
                (actix_web::http::StatusCode::UNAUTHORIZED, msg.clone())
            }
            ApiError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
            ApiError::Database(err) => {
                tracing::error!("Database error: {}", err);
                (
                    actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Database error".to_string(),
                )
            }
            ApiError::Redis(msg) => {
                tracing::error!("Redis error: {}", msg);
                (
                    actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Cache error".to_string(),
                )
            }
            ApiError::CkbRpc(msg) => {
                tracing::error!("CKB RPC error: {}", msg);
                (
                    actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "CKB node error".to_string(),
                )
            }
            ApiError::IntentError(msg) => (actix_web::http::StatusCode::BAD_REQUEST, msg.clone()),
            ApiError::PoolError(msg) => (actix_web::http::StatusCode::BAD_REQUEST, msg.clone()),
        };

        HttpResponse::build(status).json(ErrorResponse {
            success: false,
            error: message,
        })
    }
}

/// Standard API success response
#[derive(Serialize)]
pub struct ApiSuccess<T: Serialize> {
    pub success: bool,
    pub data: T,
}

impl<T: Serialize> ApiSuccess<T> {
    pub fn new(data: T) -> Self {
        Self {
            success: true,
            data,
        }
    }

    pub fn json(data: T) -> HttpResponse {
        HttpResponse::Ok().json(Self::new(data))
    }
}

/// Paginated response
#[derive(Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub success: bool,
    pub data: Vec<T>,
    pub total_count: u64,
    pub page_no: u64,
    pub page_size: u64,
}

impl<T: Serialize> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, total_count: u64, page_no: u64, page_size: u64) -> Self {
        Self {
            success: true,
            data,
            total_count,
            page_no,
            page_size,
        }
    }
}
