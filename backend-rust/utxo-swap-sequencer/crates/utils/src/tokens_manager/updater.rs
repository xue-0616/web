use api_common::context::AppContext;
use entity_crate::tokens;
use sea_orm::*;

/// Fetch token metadata from CKB Explorer API and update DB
pub async fn update_tokens(ctx: &AppContext) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let explorer_url = "https://mainnet-api.explorer.nervos.org/api/v1/udts";

    let resp = client
        .get(explorer_url)
        .query(&[("page", "1"), ("page_size", "100")])
        .header("Accept", "application/vnd.api+json")
        .send()
        .await?;

    if !resp.status().is_success() {
        tracing::warn!("CKB Explorer API returned {}", resp.status());
        return Ok(());
    }

    let body: serde_json::Value = resp.json().await?;
    let items = body["data"].as_array().cloned().unwrap_or_default();

    for item in items {
        let attrs = &item["attributes"];
        let type_hash_hex = attrs["type_hash"].as_str().unwrap_or_default();
        let symbol = attrs["symbol"].as_str().unwrap_or("UNKNOWN");
        let name = attrs["full_name"].as_str().unwrap_or(symbol);
        let decimals = attrs["decimal"].as_str()
            .and_then(|d| d.parse::<u8>().ok())
            .unwrap_or(8);
        let logo = attrs["icon_file"].as_str().map(|s| s.to_string());

        if type_hash_hex.len() < 64 { continue; }
        let type_hash = hex::decode(type_hash_hex.trim_start_matches("0x")).unwrap_or_default();
        if type_hash.len() != 32 { continue; }

        // Upsert
        let existing = tokens::Entity::find()
            .filter(tokens::Column::TypeHash.eq(type_hash.clone()))
            .one(ctx.db())
            .await?;

        if existing.is_none() {
            let new_token = tokens::ActiveModel {
                symbol: Set(symbol.to_string()),
                name: Set(name.to_string()),
                decimals: Set(decimals),
                type_hash: Set(type_hash),
                type_code_hash: Set(vec![0u8; 32]),
                type_args: Set(vec![]),
                type_hash_type: Set(entity_crate::tokens::HashType::Type),
                token_type: Set(entity_crate::tokens::TokenType::XUDT),
                logo: Set(logo),
                ..Default::default()
            };
            tokens::Entity::insert(new_token).exec(ctx.db()).await?;
        }
    }

    tracing::info!("Token metadata update complete");
    Ok(())
}
