//! HIGH-SW-1 migration: enforce at-the-storage-layer that a given
//! `(account_id, source_type, source_id)` triple can only appear once
//! in `points_history`.
//!
//! Before this migration, `tasks/claim.rs` relied on an application-
//! level "is this row already here?" SELECT followed by an INSERT and
//! a read-modify-write UPDATE on `accounts.total_points`. Two
//! concurrent claims for the same task slipped between the SELECT and
//! INSERT, both passed the duplicate check, both inserted a reward
//! row, and the account's points update lost one of the deltas to a
//! classic TOCTOU race (see `DEEP_AUDIT_SWAP_FARM_RELAYER.md`
//! §HIGH-SW-1).
//!
//! Adding a UNIQUE index is the only fix that survives:
//!   - multiple API replicas behind a load balancer
//!   - a client retrying mid-request
//!   - a badly-written script firing concurrent claims
//! The handler still needs to be rewritten to run the INSERT/UPDATE
//! inside a transaction and to translate a unique-violation into a
//! clean 400 response instead of a 500. That rewrite lives in
//! `crates/api/src/tasks/claim.rs`.
//!
//! NOTE on ordering: this migration is dated 2026-04-20 so it sorts
//! AFTER every existing migration. sea-orm-migration runs pending
//! migrations in filename order.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_index(
                Index::create()
                    .table(PointsHistory::Table)
                    .name("uniq_points_history_account_source")
                    .unique()
                    .col(PointsHistory::AccountId)
                    .col(PointsHistory::SourceType)
                    .col(PointsHistory::SourceId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(
                Index::drop()
                    .table(PointsHistory::Table)
                    .name("uniq_points_history_account_source")
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
enum PointsHistory {
    Table,
    AccountId,
    SourceType,
    SourceId,
}
