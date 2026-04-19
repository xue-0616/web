use actix_web::{dev::Payload, Error, FromRequest, HttpRequest, error::ErrorUnauthorized};
use std::future::{Ready, ready};

/// Authenticated user extracted from JWT Bearer token.
/// Use as an extractor in handler signatures to enforce authentication.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
}

impl FromRequest for AuthenticatedUser {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok());

        let token = match auth_header {
            Some(h) if h.starts_with("Bearer ") => &h[7..],
            _ => return ready(Err(ErrorUnauthorized("Missing or invalid Authorization header"))),
        };

        let ctx = match req.app_data::<actix_web::web::Data<crate::context::PaymentContext>>() {
            Some(ctx) => ctx,
            None => return ready(Err(ErrorUnauthorized("Internal configuration error"))),
        };

        match common::auth::verify_token(&ctx.config.jwt_secret, token) {
            Ok(claims) => ready(Ok(AuthenticatedUser { user_id: claims.sub })),
            Err(_) => ready(Err(ErrorUnauthorized("Invalid or expired token"))),
        }
    }
}
