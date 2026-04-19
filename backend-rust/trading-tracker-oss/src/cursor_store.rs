//! Durable substreams cursor storage (redb).
//!
//! StreamingFast requires the client to persist an opaque `cursor` string
//! produced alongside every `BlockScopedData` message, so that on reconnection
//! we can resume the stream exactly at the last-processed block. We also
//! persist `final_block_height` so that the consumer can distinguish finalized
//! from reversible data, and we store the highest processed block number so
//! reorg (undo-signal) handling can roll back in-memory state correctly.
//!
//! Reconstructed from the closed-source binary's `redb::Database` + table
//! names observed in rodata: `"meta"` table with keys `"cursor"`,
//! `"final_block_height"`, `"last_block"`.

use std::{path::Path, sync::Arc};

use redb::{Database, TableDefinition};

use crate::error::DexautoTrackerError;

/// Single table holding small opaque metadata strings.
const META: TableDefinition<&str, &str> = TableDefinition::new("meta");

/// Persistent cursor/metadata store. Cheap to clone (`Arc` inside).
#[derive(Clone)]
pub struct CursorStore {
    db: Arc<Database>,
}

/// Snapshot of everything needed to resume a substreams session.
#[derive(Debug, Clone, Default)]
pub struct CursorSnapshot {
    pub cursor: Option<String>,
    pub final_block_height: u64,
    pub last_block: u64,
}

impl CursorStore {
    /// Open (or create) the database at the given path. Parent directories are
    /// created on demand to match the closed-source binary's behaviour: it
    /// would happily run against a fresh `$TRADING_TRACKER_DB_PATH`.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, DexautoTrackerError> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| DexautoTrackerError::Database(format!("mkdir: {e}")))?;
        }
        let db = Database::create(path.as_ref())
            .map_err(|e| DexautoTrackerError::Database(format!("open: {e}")))?;

        // Ensure the table exists so read-only transactions at startup don't
        // bail out on a fresh database.
        {
            let wr = db
                .begin_write()
                .map_err(|e| DexautoTrackerError::Database(format!("begin_write: {e}")))?;
            {
                let _ = wr
                    .open_table(META)
                    .map_err(|e| DexautoTrackerError::Database(format!("open_table: {e}")))?;
            }
            wr.commit()
                .map_err(|e| DexautoTrackerError::Database(format!("commit: {e}")))?;
        }

        Ok(Self { db: Arc::new(db) })
    }

    /// Load the last persisted snapshot. Returns a default (empty) snapshot on
    /// a fresh database.
    pub fn load(&self) -> Result<CursorSnapshot, DexautoTrackerError> {
        let rd = self
            .db
            .begin_read()
            .map_err(|e| DexautoTrackerError::Database(format!("begin_read: {e}")))?;
        let tbl = rd
            .open_table(META)
            .map_err(|e| DexautoTrackerError::Database(format!("open_table: {e}")))?;
        let cursor = tbl
            .get("cursor")
            .map_err(|e| DexautoTrackerError::Database(format!("get cursor: {e}")))?
            .map(|v| v.value().to_string());
        let final_block_height = tbl
            .get("final_block_height")
            .map_err(|e| DexautoTrackerError::Database(format!("get fbh: {e}")))?
            .and_then(|v| v.value().parse().ok())
            .unwrap_or(0);
        let last_block = tbl
            .get("last_block")
            .map_err(|e| DexautoTrackerError::Database(format!("get lb: {e}")))?
            .and_then(|v| v.value().parse().ok())
            .unwrap_or(0);
        Ok(CursorSnapshot {
            cursor,
            final_block_height,
            last_block,
        })
    }

    /// Atomically persist cursor + final_block_height + last_block. All three
    /// are written in a single transaction to guarantee that a crash mid-write
    /// cannot leave the cursor out of sync with our in-memory processing
    /// position.
    pub fn save(
        &self,
        cursor: &str,
        final_block_height: u64,
        last_block: u64,
    ) -> Result<(), DexautoTrackerError> {
        let wr = self
            .db
            .begin_write()
            .map_err(|e| DexautoTrackerError::Database(format!("begin_write: {e}")))?;
        {
            let mut tbl = wr
                .open_table(META)
                .map_err(|e| DexautoTrackerError::Database(format!("open_table: {e}")))?;
            tbl.insert("cursor", cursor)
                .map_err(|e| DexautoTrackerError::Database(format!("put cursor: {e}")))?;
            let fbh = final_block_height.to_string();
            tbl.insert("final_block_height", fbh.as_str())
                .map_err(|e| DexautoTrackerError::Database(format!("put fbh: {e}")))?;
            let lb = last_block.to_string();
            tbl.insert("last_block", lb.as_str())
                .map_err(|e| DexautoTrackerError::Database(format!("put lb: {e}")))?;
        }
        wr.commit()
            .map_err(|e| DexautoTrackerError::Database(format!("commit: {e}")))?;
        Ok(())
    }

    /// On a `BlockUndoSignal`, rewind state to the last-valid block:
    /// overwrite the cursor (to `last_valid_cursor`) and clamp `last_block`.
    /// `final_block_height` is monotonic and left untouched.
    pub fn rewind(
        &self,
        last_valid_cursor: &str,
        last_valid_block: u64,
    ) -> Result<(), DexautoTrackerError> {
        let wr = self
            .db
            .begin_write()
            .map_err(|e| DexautoTrackerError::Database(format!("begin_write: {e}")))?;
        {
            let mut tbl = wr
                .open_table(META)
                .map_err(|e| DexautoTrackerError::Database(format!("open_table: {e}")))?;
            tbl.insert("cursor", last_valid_cursor)
                .map_err(|e| DexautoTrackerError::Database(format!("put cursor: {e}")))?;
            let lb = last_valid_block.to_string();
            tbl.insert("last_block", lb.as_str())
                .map_err(|e| DexautoTrackerError::Database(format!("put lb: {e}")))?;
        }
        wr.commit()
            .map_err(|e| DexautoTrackerError::Database(format!("commit: {e}")))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("cursors.redb");
        let store = CursorStore::open(&path).unwrap();
        assert_eq!(store.load().unwrap().cursor, None);
        store.save("cur-1", 100, 110).unwrap();
        let snap = store.load().unwrap();
        assert_eq!(snap.cursor.as_deref(), Some("cur-1"));
        assert_eq!(snap.final_block_height, 100);
        assert_eq!(snap.last_block, 110);
        store.rewind("cur-0", 105).unwrap();
        let snap = store.load().unwrap();
        assert_eq!(snap.cursor.as_deref(), Some("cur-0"));
        assert_eq!(snap.final_block_height, 100); // unchanged
        assert_eq!(snap.last_block, 105);
    }
}
