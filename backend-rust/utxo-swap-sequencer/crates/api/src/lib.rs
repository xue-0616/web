pub mod accounts;
pub mod chains_info;
pub mod configurations;
pub mod docs;
pub mod external;
pub mod github;
pub mod intents;
pub mod pools;
pub mod status;
pub mod tasks;
pub mod tokens;

use actix_web::web;
use std::time::Duration;
use utils::oauth_middleware::middleware::JwtAuth;
use utils::rate_limiter::RateLimiter;

/// Configure all API routes
///
/// SECURITY (C-4): JWT authentication middleware is applied to all trading endpoints
/// (intents, pools/create, tasks/claim, github, accounts/info).
/// Public endpoints (status, chains-info, configurations, pools read, tokens, intents/status)
/// remain unauthenticated.
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    // Read JWT secret from env for middleware
    // SECURITY: JWT_SECRET must be set and sufficiently long to prevent brute-force attacks
    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET env var required");
    assert!(
        jwt_secret.len() >= 32,
        "JWT_SECRET must be at least 32 characters long, got {}",
        jwt_secret.len()
    );

    cfg.service(
        web::scope("/api/v1")
            // === PUBLIC ENDPOINTS (no auth required) ===
            // Status
            .route("/status", web::get().to(status::get_status))
            // Chains info
            .route("/chains-info", web::get().to(chains_info::get_chains_info))
            // Configurations
            .route(
                "/configurations",
                web::get().to(configurations::get_configurations),
            )
            // Accounts — login is public (it creates the JWT).
            // CRIT-SW-3: /accounts/info used to live inside the same
            // /accounts scope and rely on a hand-rolled JWT decode in
            // the handler. That was fragile in two ways:
            //   * a future maintainer adding /accounts/* read-only
            //     routes would silently inherit "no middleware" and
            //     might forget the inline check;
            //   * the inline check used `Validation::default()` which
            //     does NOT pin algorithm/iss/aud, while the real
            //     `JwtAuth` middleware does (see
            //     `utils::oauth_middleware::middleware::JwtAuth`).
            // Move /info into its own /accounts-auth scope guarded by
            // the same `JwtAuth` middleware every other authenticated
            // endpoint uses (mirror of /tasks vs /tasks-auth).
            .service(
                web::scope("/accounts")
                    .route("/login", web::post().to(accounts::login::login)),
            )
            .service(
                web::scope("/accounts-auth")
                    .wrap(JwtAuth::new(jwt_secret.clone()))
                    .route("/info", web::get().to(accounts::info::get_account_info)),
            )
            // Intent status query (read-only, public)
            .route(
                "/intents/status",
                web::get().to(intents::get_intent_status::handler),
            )
            // Pools (read-only endpoints are public)
            .service(
                web::scope("/pools")
                    .route("", web::get().to(pools::pool_list::handler))
                    .route(
                        "/by-tokens",
                        web::get().to(pools::get_pool_by_tokens::handler),
                    )
                    .route("/status", web::get().to(pools::status::handler))
                    .route(
                        "/transactions",
                        web::get().to(pools::transaction_list::handler),
                    )
                    .route(
                        "/candlestick",
                        web::get().to(pools::candlestick::handler),
                    ),
            )
            // Tokens (read-only, public)
            .service(
                web::scope("/tokens")
                    .route("", web::get().to(tokens::get_tokens::handler))
                    .route("/top", web::get().to(tokens::top_tokens::handler)),
            )
            // Tasks list (read-only, public)
            .route("/tasks", web::get().to(tasks::list::handler))

            // === PROTECTED ENDPOINTS (JWT auth required + rate limited) ===
            // SECURITY (H-3): Rate limiting — 30 requests per minute per IP for trading endpoints
            // Intents — trading endpoints (C-4)
            .service(
                web::scope("/intents")
                    .wrap(RateLimiter::new(30, Duration::from_secs(60)))
                    .wrap(JwtAuth::new(jwt_secret.clone()))
                    .route(
                        "/swap-exact-input-for-output",
                        web::post().to(intents::swap_exact_input_for_output::handler),
                    )
                    .route(
                        "/swap-input-for-exact-output",
                        web::post().to(intents::swap_input_for_exact_output::handler),
                    )
                    .route(
                        "/add-liquidity",
                        web::post().to(intents::add_liquidity::handler),
                    )
                    .route(
                        "/remove-liquidity",
                        web::post().to(intents::remove_liquidity::handler),
                    ),
            )
            // Pool creation (requires auth)
            .service(
                web::scope("/pools-admin")
                    .wrap(JwtAuth::new(jwt_secret.clone()))
                    .route("/create", web::post().to(pools::create_pool::handler)),
            )
            // Tasks claim (requires auth) (H-7)
            .service(
                web::scope("/tasks-auth")
                    .wrap(JwtAuth::new(jwt_secret.clone()))
                    .route("/claim", web::post().to(tasks::claim::handler)),
            )
            // External (UTXO Global integration) — uses API key auth, not JWT
            .service(
                web::scope("/external")
                    .route(
                        "/utxo-global",
                        web::get().to(external::get_utxo_global::handler),
                    )
                    .route(
                        "/utxo-global/swap",
                        web::post().to(external::swap_utxo_global::handler),
                    ),
            )
            // GitHub (issue/image upload) — requires auth (H-6)
            .service(
                web::scope("/github")
                    .wrap(JwtAuth::new(jwt_secret.clone()))
                    .route("/issue", web::post().to(github::create_issue::handler))
                    .route("/upload", web::post().to(github::upload_image::handler)),
            ),
    );

    // OpenAPI docs
    cfg.service(docs::redoc_handler());
}
