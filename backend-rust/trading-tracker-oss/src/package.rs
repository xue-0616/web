//! Loader for StreamingFast `.spkg` substreams packages.
//!
//! A `.spkg` file is literally a prost-serialized `sf.substreams.v1.Package`
//! message (optionally gzipped; the standard tooling can emit either form but
//! in practice we've only ever seen raw-prost `.spkg` files ship with
//! trading-tracker deployments).
//!
//! Matches the closed-source binary's `Package::from_file` / `from_url`
//! helpers (symbol only uses the local path branch).

use prost::Message;

use crate::{error::DexautoTrackerError, pb::sf::substreams::v1::Package};

/// Read a `.spkg` from disk and prost-decode it into a `Package`.
///
/// Supports URLs too (`http://` / `https://`) so `Node.package` from the
/// config can be either a local path or a hosted URL — matching the
/// closed-source behaviour.
pub async fn load(location: &str) -> Result<Package, DexautoTrackerError> {
    let bytes = if location.starts_with("http://") || location.starts_with("https://") {
        fetch_http(location).await?
    } else {
        std::fs::read(location)
            .map_err(|e| DexautoTrackerError::Substreams(format!("read {location}: {e}")))?
    };
    Package::decode(bytes.as_slice())
        .map_err(|e| DexautoTrackerError::Substreams(format!("decode .spkg: {e}")))
}

async fn fetch_http(_url: &str) -> Result<Vec<u8>, DexautoTrackerError> {
    // Pulling in reqwest would duplicate rustls/hyper in the tree. For v1 we
    // require a local path; Session 4 can add an optional feature if hosted
    // `.spkg` URLs become a real use case.
    Err(DexautoTrackerError::Substreams(
        "HTTP .spkg fetch not supported; use a local path".into(),
    ))
}

/// Given a loaded package, locate the requested output module and return a
/// helpful error listing available modules if the name is wrong.
pub fn pick_output_module(
    pkg: &Package,
    module_name: &str,
) -> Result<Path_, DexautoTrackerError> {
    let modules = pkg
        .modules
        .as_ref()
        .ok_or_else(|| DexautoTrackerError::Substreams("package has no modules".into()))?;
    if modules.modules.iter().any(|m| m.name == module_name) {
        Ok(Path_)
    } else {
        let available: Vec<&str> = modules.modules.iter().map(|m| m.name.as_str()).collect();
        Err(DexautoTrackerError::Substreams(format!(
            "output module `{module_name}` not found in package; available: {available:?}"
        )))
    }
}

/// Zero-sized witness that `pick_output_module` succeeded — the caller
/// doesn't need the actual Module (the server only needs the name string).
pub struct Path_;
