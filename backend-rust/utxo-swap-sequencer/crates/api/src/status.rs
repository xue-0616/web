use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiSuccess};
use serde::Serialize;

#[derive(Serialize)]
pub struct StatusResponse {
    pub status: &'static str,
    pub version: &'static str,
}

pub async fn get_status(_ctx: web::Data<AppContext>) -> HttpResponse {
    ApiSuccess::json(StatusResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}
