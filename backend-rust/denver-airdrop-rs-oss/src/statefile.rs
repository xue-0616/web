//! Atomic per-source state file I/O.
//!
//! Pattern: write to `{path}.tmp` → fsync → rename over `{path}`.
//! This matches the closed-source ELF which also writes through a temp
//! file (Ghidra shows `std::fs::rename` in the AirDrop save path).

use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};

use ethers::types::Address;

use crate::{airdrop::AirDrop, error::Error};

/// Path convention: `{store_dir}/0x{source:x}.json`.
pub fn state_path(store_dir: &Path, source: &Address) -> PathBuf {
    store_dir.join(format!("0x{source:x}.json"))
}

pub fn load(path: &Path) -> Result<Option<AirDrop>, Error> {
    match fs::read(path) {
        Ok(bytes) => {
            let ad: AirDrop = serde_json::from_slice(&bytes)?;
            Ok(Some(ad))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(Error::Io { path: path.to_path_buf(), source: e }),
    }
}

pub fn save(path: &Path, ad: &AirDrop) -> Result<(), Error> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| Error::Io {
            path: parent.to_path_buf(),
            source: e,
        })?;
    }
    let body = serde_json::to_vec_pretty(ad)?;
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = File::create(&tmp).map_err(|e| Error::Io {
            path: tmp.clone(),
            source: e,
        })?;
        f.write_all(&body).map_err(|e| Error::Io {
            path: tmp.clone(),
            source: e,
        })?;
        f.sync_all().map_err(|e| Error::Io {
            path: tmp.clone(),
            source: e,
        })?;
    }
    fs::rename(&tmp, path).map_err(|e| Error::Io {
        path: path.to_path_buf(),
        source: e,
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::airdrop::AriDropInfo;
    use ethers::types::{H160, H256, U256};

    fn addr(n: u8) -> Address { H160::from_low_u64_be(n as u64) }

    #[test]
    fn load_missing_returns_none() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("none.json");
        assert!(load(&p).unwrap().is_none());
    }

    #[test]
    fn save_then_load_round_trip() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("s.json");
        let ad = AirDrop::new(addr(1), 100);
        save(&p, &ad).unwrap();
        let back = load(&p).unwrap().unwrap();
        assert_eq!(back, ad);
    }

    #[test]
    fn save_is_atomic_tmp_not_left_behind() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("s.json");
        let ad = AirDrop::new(addr(1), 100);
        save(&p, &ad).unwrap();
        let tmp = p.with_extension("json.tmp");
        assert!(!tmp.exists(), "tmp sibling must be renamed/removed");
    }

    #[test]
    fn save_overwrites_existing() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("s.json");
        let mut ad = AirDrop::new(addr(1), 100);
        save(&p, &ad).unwrap();
        ad.last_processed_block = 500;
        save(&p, &ad).unwrap();
        assert_eq!(load(&p).unwrap().unwrap().last_processed_block, 500);
    }

    #[test]
    fn save_creates_parent_directory() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("nested").join("deep").join("s.json");
        let ad = AirDrop::new(addr(1), 0);
        save(&p, &ad).unwrap();
        assert!(p.exists());
    }

    #[test]
    fn load_malformed_is_serde_error() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "{ not json").unwrap();
        assert!(matches!(load(tmp.path()).unwrap_err(), Error::Serde(_)));
    }

    #[test]
    fn state_path_is_lowercase_hex() {
        let d = Path::new("/tmp/store");
        let p = state_path(d, &addr(0xab));
        assert!(p.to_str().unwrap().ends_with("0x00000000000000000000000000000000000000ab.json"));
    }

    #[test]
    fn complex_state_serde_roundtrip() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("s.json");
        let mut ad = AirDrop::new(addr(1), 500);
        ad.airdrops.push(AriDropInfo {
            deploy_block_number: 501,
            deploy_tx_hash: H256::from_low_u64_be(1),
            airdrop_tx_hash: Some(H256::from_low_u64_be(2)),
            source_address: addr(1),
            token_id: Some(U256::from(7)),
            receivers: vec![addr(10), addr(11)],
        });
        save(&p, &ad).unwrap();
        let back = load(&p).unwrap().unwrap();
        assert_eq!(back, ad);
    }
}
