//! Redis-stream task scheduler.
//!
//! Mirrors the closed-source `scheduler` crate: blocking XREADGROUP
//! pull, call prover, persist result, XACK. The ELF logs
//! "load tasks from stream", "Email tasks count: N", "prove [..] error",
//! "prove [..] sucessed" — we keep the same log phrasing so log
//! dashboards continue to work.

use std::sync::Arc;

use sqlx::MySqlPool;
use tracing::{error, info, warn};

use crate::{
    daos::email_proofs::{self, EmailProof},
    error::Error,
    mq::RedisPool,
    prover::{ProofArtifact, Prover},
    types::ProveTask,
};

pub struct Scheduler<P: Prover> {
    pub db: MySqlPool,
    pub redis: RedisPool,
    pub prover: Arc<P>,
    pub stream: String,
    pub group: String,
    pub consumer: String,
}

impl<P: Prover> Scheduler<P> {
    /// Execute exactly one task end-to-end (prove + persist). Returns
    /// `Ok(None)` if the task had already been processed (dedup by
    /// header_hash), `Ok(Some)` otherwise. Public so tests can drive a
    /// single iteration deterministically.
    pub async fn run_one(&self, task: &ProveTask) -> Result<Option<ProofArtifact>, Error> {
        if email_proofs::exists(&self.db, &task.header_hash).await? {
            info!(header_hash = %task.header_hash, "task already existed — skipping");
            return Ok(None);
        }
        info!(header_hash = %task.header_hash, "Begin to prove:");
        let artifact = self
            .prover
            .prove(task)
            .await
            .map_err(Error::Prover)?;

        let row = EmailProof {
            header_hash: artifact.header_hash.clone(),
            email_type: artifact.email_type as i32,
            from_left_index: artifact.from_left_index,
            from_len: artifact.from_len,
            success: artifact.success,
            public_inputs_num: artifact.public_inputs_num.clone(),
            domain_size: artifact.domain_size.clone(),
            header_pub_match: artifact.header_pub_match.clone(),
            public_inputs: artifact.public_inputs.clone(),
            proof: artifact.proof.clone(),
            failed_reason: artifact.failed_reason.clone(),
        };

        match email_proofs::upsert(&self.db, &row).await {
            Ok(()) if row.success => info!(header_hash = %row.header_hash, "prove sucessed"),
            Ok(()) => warn!(header_hash = %row.header_hash, reason = %row.failed_reason, "prove failed"),
            Err(e) => {
                error!(header_hash = %row.header_hash, err = %e, "store email proof error");
                return Err(e.into());
            }
        }
        Ok(Some(artifact))
    }
}
