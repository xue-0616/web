use api_common::context::AppContext;
use entity_crate::intents::{self, IntentStatus};
use entity_crate::accounts;
use entity_crate::points_history;
use sea_orm::*;

/// Background loop entry point called from main.rs
pub async fn start(ctx: AppContext) -> anyhow::Result<()> {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
    loop {
        interval.tick().await;
        if let Err(e) = award_points_for_completed_intents(&ctx).await {
            tracing::error!("Tasks manager error: {}", e);
        }
    }
}

/// Periodically check completed intents and award points to accounts
pub async fn award_points_for_completed_intents(ctx: &AppContext) -> anyhow::Result<()> {
    // Find completed intents that haven't been awarded points yet
    let completed = intents::Entity::find()
        .filter(intents::Column::Status.eq(IntentStatus::Completed))
        .order_by_desc(intents::Column::UpdatedAt)
        .limit(100)
        .all(ctx.db())
        .await?;

    for intent in completed {
        // Check if points already awarded
        let existing = points_history::Entity::find()
            .filter(points_history::Column::SourceId.eq(intent.id))
            .filter(points_history::Column::SourceType.eq(points_history::SourceType::Swap))
            .one(ctx.db())
            .await?;

        if existing.is_some() { continue; }

        // Find or create account
        let account = accounts::Entity::find()
            .filter(accounts::Column::LockHash.eq(intent.lock_hash.clone()))
            .one(ctx.db())
            .await?;

        let account_id = if let Some(acc) = account {
            acc.id
        } else {
            let new_acc = accounts::ActiveModel {
                lock_hash: Set(intent.lock_hash.clone()),
                wallet_types: Set(intent.wallet_type.clone().unwrap_or_default()),
                total_points: Set(0),
                ..Default::default()
            };
            let result = accounts::Entity::insert(new_acc).exec(ctx.db()).await?;
            result.last_insert_id
        };

        // Calculate points (base: 10 per swap, bonus for volume)
        let points = 10u64;

        // Insert points record
        let record = points_history::ActiveModel {
            account_id: Set(account_id),
            points: Set(points),
            source_type: Set(points_history::SourceType::Swap),
            source_id: Set(intent.id),
            ..Default::default()
        };
        points_history::Entity::insert(record).exec(ctx.db()).await?;

        // Update account total
        let mut acc_am = accounts::ActiveModel {
            id: Set(account_id),
            ..Default::default()
        };
        // Use raw SQL for atomic increment
        accounts::Entity::update_many()
            .col_expr(accounts::Column::TotalPoints,
                sea_orm::sea_query::Expr::col(accounts::Column::TotalPoints).add(points))
            .filter(accounts::Column::Id.eq(account_id))
            .exec(ctx.db())
            .await?;
    }

    Ok(())
}
