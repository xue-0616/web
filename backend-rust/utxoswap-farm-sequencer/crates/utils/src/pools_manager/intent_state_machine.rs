//! Atomic state transitions for `farm_intents` rows.
//!
//! # HIGH-FM-3 scaffold (round 9, part 2)
//!
//! The pools-manager loop needs four primitive transitions that
//! each MUST be single-statement atomic so two concurrent workers
//! can't end up with rows in a "half-claimed" state:
//!
//!   claim          Pending    -> Processing
//!   release        Processing -> Pending    (Transient build failure)
//!   mark_failed    Processing -> Failed     (InvalidInput build failure)
//!   mark_completed Processing -> Completed  (after on-chain confirm)
//!
//! Each is exposed below as an `async fn` over a
//! `sea_orm::DatabaseConnection`. The functions take `&[u64]` id
//! lists and return the number of rows that actually transitioned,
//! which MAY be less than the input length — if another worker
//! raced us on a subset of those ids, the `WHERE status = ...`
//! clause silently skips those rows. Callers must handle a short
//! return by treating the raced rows as "not ours".
//!
//! # Why each transition is a single UPDATE
//!
//! A SELECT ... FOR UPDATE + later UPDATE opens a window between
//! the two statements where another worker could commit and move
//! the row. A single `UPDATE ... WHERE status = $expected` is
//! self-atomic on MySQL's default READ-COMMITTED isolation: the
//! storage engine takes row locks for the duration of the
//! statement and releases them at commit. That's exactly the
//! semantic we need — "move N rows from state A to state B, tell
//! me how many you actually moved".
//!
//! # Why tests assert on generated SQL strings
//!
//! A bug in the WHERE clause is the single highest-value thing to
//! regression-test here — a missing `status = Pending` check
//! would let us claim already-processing rows, double-spending
//! the underlying intent cells. Rather than wait for the
//! integration-smoke job (round 8) to exercise these statements
//! against a real MySQL, each builder is also callable via
//! `build_*_query()` which returns the sea-orm `UpdateMany` so
//! tests can call `.build(DatabaseBackend::MySql).to_string()`
//! and assert on the SQL shape. Fast to run, no fixtures needed,
//! catches WHERE-clause regressions before they reach CI.

use entity_crate::farm_intents;
use sea_orm::sea_query::Expr;
use sea_orm::{ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, UpdateMany};

/// Build the `UpdateMany` for the `Pending -> Processing` claim.
/// Split out from `claim` so unit tests can assert on the SQL
/// without a DB connection.
pub fn build_claim_query(ids: &[u64]) -> UpdateMany<farm_intents::Entity> {
    farm_intents::Entity::update_many()
        .col_expr(
            farm_intents::Column::Status,
            Expr::value(farm_intents::FarmIntentStatus::Processing),
        )
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Pending))
        .filter(farm_intents::Column::Id.is_in(ids.iter().copied()))
}

/// Build the `UpdateMany` for the `Processing -> Pending` rollback.
pub fn build_release_query(ids: &[u64]) -> UpdateMany<farm_intents::Entity> {
    farm_intents::Entity::update_many()
        .col_expr(
            farm_intents::Column::Status,
            Expr::value(farm_intents::FarmIntentStatus::Pending),
        )
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Processing))
        .filter(farm_intents::Column::Id.is_in(ids.iter().copied()))
}

/// Build the `UpdateMany` for the terminal `Processing -> Failed`
/// transition. `reason_json` is stored verbatim on the
/// `error_reason` column so operators can grep the DB for why a
/// batch failed.
pub fn build_mark_failed_query(
    ids: &[u64],
    reason_json: serde_json::Value,
) -> UpdateMany<farm_intents::Entity> {
    farm_intents::Entity::update_many()
        .col_expr(
            farm_intents::Column::Status,
            Expr::value(farm_intents::FarmIntentStatus::Failed),
        )
        .col_expr(
            farm_intents::Column::ErrorReason,
            Expr::value(Some(reason_json)),
        )
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Processing))
        .filter(farm_intents::Column::Id.is_in(ids.iter().copied()))
}

/// Build the `UpdateMany` for the happy-path `Processing ->
/// Completed` transition, stamping each row with the produced
/// `batch_tx_hash` so operators can trace rows to the on-chain
/// transaction.
pub fn build_mark_completed_query(
    ids: &[u64],
    batch_tx_hash: Vec<u8>,
) -> UpdateMany<farm_intents::Entity> {
    farm_intents::Entity::update_many()
        .col_expr(
            farm_intents::Column::Status,
            Expr::value(farm_intents::FarmIntentStatus::Completed),
        )
        .col_expr(
            farm_intents::Column::BatchTxHash,
            Expr::value(Some(batch_tx_hash)),
        )
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Processing))
        .filter(farm_intents::Column::Id.is_in(ids.iter().copied()))
}

/// Execute the claim transition. Returns the number of rows that
/// actually moved `Pending -> Processing`, which may be less than
/// `ids.len()` if another worker already claimed some of them.
pub async fn claim(db: &DatabaseConnection, ids: &[u64]) -> Result<u64, DbErr> {
    if ids.is_empty() {
        return Ok(0);
    }
    let res = build_claim_query(ids).exec(db).await?;
    Ok(res.rows_affected)
}

/// Execute the release transition (rollback on Transient failure).
pub async fn release(db: &DatabaseConnection, ids: &[u64]) -> Result<u64, DbErr> {
    if ids.is_empty() {
        return Ok(0);
    }
    let res = build_release_query(ids).exec(db).await?;
    Ok(res.rows_affected)
}

/// Execute the terminal failure transition.
pub async fn mark_failed(
    db: &DatabaseConnection,
    ids: &[u64],
    reason_json: serde_json::Value,
) -> Result<u64, DbErr> {
    if ids.is_empty() {
        return Ok(0);
    }
    let res = build_mark_failed_query(ids, reason_json).exec(db).await?;
    Ok(res.rows_affected)
}

/// Execute the happy-path completion transition.
pub async fn mark_completed(
    db: &DatabaseConnection,
    ids: &[u64],
    batch_tx_hash: Vec<u8>,
) -> Result<u64, DbErr> {
    if ids.is_empty() {
        return Ok(0);
    }
    let res = build_mark_completed_query(ids, batch_tx_hash)
        .exec(db)
        .await?;
    Ok(res.rows_affected)
}

#[cfg(test)]
mod tests {
    //! Each test builds an `UpdateMany` via the public builder
    //! helper, calls `.build(DatabaseBackend::MySql)` to get the
    //! raw SQL string, and asserts on structural invariants. We
    //! don't hit a real DB — the whole point of these tests is
    //! to pin the WHERE clauses so a careless edit can't remove
    //! the status guard and silently re-enable double-spend.

    use super::*;
    use sea_orm::{DatabaseBackend, QueryTrait};

    /// Render a builder as its MySQL SQL string for inspection.
    fn sql(q: UpdateMany<farm_intents::Entity>) -> String {
        q.build(DatabaseBackend::MySql).to_string()
    }

    #[test]
    fn claim_sql_has_pending_guard_and_id_filter() {
        let s = sql(build_claim_query(&[1, 2, 3]));
        assert!(s.contains("`farm_intents`"), "table name missing: {s}");
        assert!(s.contains("UPDATE"), "not an UPDATE statement: {s}");
        assert!(s.contains("SET"), "missing SET clause: {s}");
        assert!(s.contains("`status`"), "status column not set: {s}");
        assert!(s.contains("WHERE"), "missing WHERE clause: {s}");
        assert!(s.contains("IN"), "missing IN clause: {s}");
        // The status guard is what makes this atomic against a
        // concurrent claim. If someone removes it we silently
        // double-claim rows already in Processing.
        assert!(
            s.matches("`status`").count() >= 2,
            "status must appear in both SET and WHERE: {s}"
        );
    }

    #[test]
    fn release_sql_has_processing_guard() {
        let s = sql(build_release_query(&[42]));
        assert!(s.contains("`farm_intents`"));
        assert!(s.contains("UPDATE"));
        assert!(s.contains("WHERE"));
        assert!(
            s.matches("`status`").count() >= 2,
            "status must appear in both SET and WHERE: {s}"
        );
    }

    #[test]
    fn mark_failed_sql_carries_error_reason_column() {
        let s = sql(build_mark_failed_query(
            &[1],
            serde_json::json!({"kind": "InvalidInput", "msg": "bad pool data"}),
        ));
        assert!(
            s.contains("`error_reason`"),
            "error_reason column missing: {s}"
        );
        assert!(s.contains("`status`"));
        assert!(s.contains("WHERE"));
    }

    #[test]
    fn mark_completed_sql_carries_batch_tx_hash_column() {
        let s = sql(build_mark_completed_query(&[1, 2], vec![0xaa; 32]));
        assert!(
            s.contains("`batch_tx_hash`"),
            "batch_tx_hash column missing: {s}"
        );
        assert!(s.contains("`status`"));
    }

    #[test]
    fn all_four_statements_filter_by_status_not_just_id() {
        // Regression guard: a future edit must not accidentally
        // drop the status guard on any transition. Each builder
        // must reference `status` at least twice — once in the
        // SET clause and once in WHERE.
        let cases: Vec<(&str, String)> = vec![
            ("claim", sql(build_claim_query(&[1]))),
            ("release", sql(build_release_query(&[1]))),
            (
                "mark_failed",
                sql(build_mark_failed_query(&[1], serde_json::json!({}))),
            ),
            (
                "mark_completed",
                sql(build_mark_completed_query(&[1], vec![0; 32])),
            ),
        ];
        for (name, s) in cases {
            let count = s.matches("`status`").count();
            assert!(
                count >= 2,
                "{name}: expected `status` to appear in both SET and WHERE, got {count} in:\n{s}"
            );
        }
    }
}
