//! Per-request UUID middleware.
//!
//! Design notes:
//!
//! - The id is stored as a plain [`String`] inside the request extensions
//!   so downstream handlers can `req.extensions().get::<RequestIdValue>()`
//!   without pulling this crate as a runtime dep.
//! - Incoming `X-Request-ID` headers are trusted only if they look like a
//!   canonical uuid; this prevents log-injection / header-spoof where a
//!   client sends a header value containing `\n` or extreme length.
//! - The header name is exposed as a public constant so callers can use
//!   the same spelling in response headers / log formatting without
//!   repeating magic strings.

use std::future::{ready, Ready};

use actix_web::{
    body::EitherBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    http::header::{HeaderName, HeaderValue},
    Error, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use uuid::Uuid;

/// Canonical header name for propagating a request id across services.
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Newtype wrapper so handlers can fetch the id via
/// `req.extensions().get::<RequestIdValue>()`.
#[derive(Debug, Clone)]
pub struct RequestIdValue(pub String);

/// Zero-config factory for the middleware.
#[derive(Debug, Default, Clone)]
pub struct RequestId;

impl<S, B> Transform<S, ServiceRequest> for RequestId
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = RequestIdMw<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequestIdMw { inner: service }))
    }
}

/// Stateful middleware returned by the [`RequestId`] factory.
pub struct RequestIdMw<S> {
    inner: S,
}

impl<S, B> Service<ServiceRequest> for RequestIdMw<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(inner);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Only trust the inbound header if it's a canonical uuid — avoids
        // having user-controlled values leak into our structured logs.
        let incoming = req
            .headers()
            .get(REQUEST_ID_HEADER)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| Uuid::parse_str(s).ok().map(|_| s.to_owned()));
        let id = incoming.unwrap_or_else(|| Uuid::new_v4().to_string());

        req.extensions_mut().insert(RequestIdValue(id.clone()));

        let fut = self.inner.call(req);
        Box::pin(async move {
            let mut res = fut.await?;
            // `insert_header` is infallible for an id that parsed as uuid.
            if let Ok(hv) = HeaderValue::from_str(&id) {
                res.headers_mut().insert(HeaderName::from_static(REQUEST_ID_HEADER), hv);
            }
            Ok(res.map_into_left_body())
        })
    }
}
