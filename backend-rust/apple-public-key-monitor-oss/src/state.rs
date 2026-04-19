//! Atomic on-disk snapshot of the last-seen kid set.
//!
//! Writes are **atomic**: we write to `<path>.tmp` then `rename()` — this
//! prevents a crash mid-write from producing a corrupt JSON file that the
//! next run would refuse to parse and default to "every key is new",
//! spamming Slack with a false positive.

use std::{
    collections::BTreeSet,
    io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    /// The kid set from the last successful poll. Empty on first-run.
    pub kids: BTreeSet<String>,
    /// Unix timestamp (seconds) of the last successful save — useful for
    /// operators checking whether monitoring is still alive.
    pub last_success_unix: u64,
}

pub struct Store {
    path: PathBuf,
}

impl Store {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    /// Load the snapshot. If the file does not exist, returns a default
    /// (empty) snapshot — this is first-run.
    pub async fn load(&self) -> io::Result<Snapshot> {
        match tokio::fs::read(&self.path).await {
            Ok(bytes) => {
                serde_json::from_slice(&bytes).map_err(io::Error::other)
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Snapshot::default()),
            Err(e) => Err(e),
        }
    }

    /// Atomically persist the snapshot.
    pub async fn save(&self, snap: &Snapshot) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            if !parent.as_os_str().is_empty() {
                tokio::fs::create_dir_all(parent).await?;
            }
        }
        let tmp: PathBuf = tmp_path(&self.path);
        let body = serde_json::to_vec_pretty(snap).map_err(io::Error::other)?;
        tokio::fs::write(&tmp, &body).await?;
        tokio::fs::rename(&tmp, &self.path).await?;
        Ok(())
    }
}

fn tmp_path(p: &Path) -> PathBuf {
    let mut tmp = p.to_path_buf();
    let file = tmp
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "state.json".into());
    tmp.set_file_name(format!(".{file}.tmp"));
    tmp
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn missing_file_yields_default() {
        let tmp = tempfile::tempdir().unwrap();
        let store = Store::new(tmp.path().join("x.json"));
        let snap = store.load().await.unwrap();
        assert!(snap.kids.is_empty());
        assert_eq!(snap.last_success_unix, 0);
    }

    #[tokio::test]
    async fn save_then_load_roundtrips() {
        let tmp = tempfile::tempdir().unwrap();
        let store = Store::new(tmp.path().join("x.json"));
        let snap = Snapshot {
            kids: ["a", "b"].into_iter().map(String::from).collect(),
            last_success_unix: 42,
        };
        store.save(&snap).await.unwrap();
        let loaded = store.load().await.unwrap();
        assert_eq!(loaded.kids, snap.kids);
        assert_eq!(loaded.last_success_unix, 42);
    }

    #[tokio::test]
    async fn save_creates_parent_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let deep = tmp.path().join("nested/sub/x.json");
        let store = Store::new(&deep);
        store.save(&Snapshot::default()).await.unwrap();
        assert!(deep.exists());
    }

    #[tokio::test]
    async fn corrupt_file_returns_error() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("bad.json");
        tokio::fs::write(&path, b"{not json").await.unwrap();
        let store = Store::new(&path);
        // We want a hard error, not a silent "default" — a corrupt state
        // file is an ops alarm, not a "start fresh" condition.
        assert!(store.load().await.is_err());
    }
}
