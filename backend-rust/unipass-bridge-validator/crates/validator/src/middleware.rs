use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse,
    body::EitherBody,
};
use std::future::{self, Future, Ready};
use std::pin::Pin;
use std::rc::Rc;
use subtle::ConstantTimeEq;

/// API key authentication middleware.
/// Checks X-API-Key header against configured key using constant-time comparison.
/// Skips auth for health-check paths (/api/v1/status).
pub struct ApiKeyAuth {
    api_key: String,
}

impl ApiKeyAuth {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

impl<S, B> Transform<S, ServiceRequest> for ApiKeyAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = ApiKeyAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        future::ready(Ok(ApiKeyAuthMiddleware {
            service: Rc::new(service),
            api_key: self.api_key.clone(),
        }))
    }
}

pub struct ApiKeyAuthMiddleware<S> {
    service: Rc<S>,
    api_key: String,
}

impl<S, B> Service<ServiceRequest> for ApiKeyAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let path = req.path().to_string();

        // Skip auth for health check and status endpoints
        if path.ends_with("/status") || path == "/health" {
            let svc = self.service.clone();
            return Box::pin(async move {
                let res = svc.call(req).await?;
                Ok(res.map_into_left_body())
            });
        }

        // Check API key
        let provided_key = req
            .headers()
            .get("X-API-Key")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let expected_key = &self.api_key;

        // Constant-time comparison to prevent timing attacks
        let is_valid = if expected_key.is_empty() {
            // If no API key configured, reject all authenticated requests
            false
        } else {
            bool::from(
                provided_key.as_bytes().ct_eq(expected_key.as_bytes())
            )
        };

        if is_valid {
            let svc = self.service.clone();
            Box::pin(async move {
                let res = svc.call(req).await?;
                Ok(res.map_into_left_body())
            })
        } else {
            Box::pin(async move {
                let response = HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "Invalid or missing API key"}));
                Ok(req.into_response(response).map_into_right_body())
            })
        }
    }
}
