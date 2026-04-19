use actix_web::{
    body::EitherBody,
    dev::{ServiceRequest, ServiceResponse, Transform, Service},
    Error, HttpMessage, HttpResponse,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::future::{Ready, ready, Future};
use std::pin::Pin;
use std::sync::Arc;

/// JWT claims extracted from token and stored in request extensions
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct JwtClaims {
    pub sub: String,        // lock_hash hex
    pub account_id: u64,
    pub wallet_type: String,
    pub exp: u64,
    pub iat: u64,
}

/// JWT authentication middleware factory for protected routes
#[derive(Clone)]
pub struct JwtAuth {
    jwt_secret: Arc<String>,
}

impl JwtAuth {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            jwt_secret: Arc::new(jwt_secret),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for JwtAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = JwtAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(JwtAuthMiddleware {
            service: Arc::new(service),
            jwt_secret: self.jwt_secret.clone(),
        }))
    }
}

pub struct JwtAuthMiddleware<S> {
    service: Arc<S>,
    jwt_secret: Arc<String>,
}

impl<S, B> Service<ServiceRequest> for JwtAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(
        &self,
        _ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        std::task::Poll::Ready(Ok(()))
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let jwt_secret = self.jwt_secret.clone();

        Box::pin(async move {
            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(|s| s.to_string());

            match auth_header {
                Some(token) => {
                    let token_data = decode::<JwtClaims>(
                        &token,
                        &DecodingKey::from_secret(jwt_secret.as_bytes()),
                        &Validation::default(),
                    );

                    match token_data {
                        Ok(data) => {
                            req.extensions_mut().insert(data.claims);
                            let res = service.call(req).await?;
                            Ok(res.map_into_left_body())
                        }
                        Err(_) => {
                            let resp = HttpResponse::Unauthorized()
                                .json(serde_json::json!({"success": false, "error": "Invalid or expired token"}));
                            Ok(req.into_response(resp).map_into_right_body())
                        }
                    }
                }
                None => {
                    let resp = HttpResponse::Unauthorized()
                        .json(serde_json::json!({"success": false, "error": "Missing Authorization header"}));
                    Ok(req.into_response(resp).map_into_right_body())
                }
            }
        })
    }
}

/// Helper to extract account_id from JWT claims stored in request extensions
pub fn extract_account_id_from_claims(req: &actix_web::HttpRequest) -> Result<u64, actix_web::Error> {
    let extensions = req.extensions();
    let claims = extensions.get::<JwtClaims>()
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Missing JWT claims"))?;
    Ok(claims.account_id)
}

/// Legacy function-based JWT auth (kept for backward compatibility)
pub async fn jwt_auth(
    req: ServiceRequest,
    jwt_secret: &str,
) -> Result<ServiceRequest, Error> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    match auth_header {
        Some(token) => {
            let token_data = decode::<serde_json::Value>(
                token,
                &DecodingKey::from_secret(jwt_secret.as_bytes()),
                &Validation::default(),
            )
            .map_err(|_| actix_web::error::ErrorUnauthorized("Invalid token"))?;

            req.extensions_mut().insert(token_data.claims);
            Ok(req)
        }
        None => Err(actix_web::error::ErrorUnauthorized("Missing token")),
    }
}
