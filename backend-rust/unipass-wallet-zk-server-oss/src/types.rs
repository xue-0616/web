//! Shared domain types.
//!
//! Field counts + names recovered from the ELF's rodata:
//!   * `struct GenProofRequest with 2 elements`
//!   * `struct ProveTask with 3 elements`
//!   * `struct ZkParams with 2 elements`

use serde::{Deserialize, Serialize};

/// Supported email circuit flavours — the ELF discriminates at least by
/// public-input count (1024 vs 2048, i.e. two SRS sizes loaded). We
/// expose the "OpenID" vs "SMTP" separation typical of UniPass Snap.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[repr(i32)]
pub enum EmailType {
    /// SMTP email with full DKIM-Signature (circuit with 2048 public inputs).
    Smtp = 0,
    /// OpenID-bound email flow (circuit with 1024 public inputs).
    OpenId = 1,
}

impl TryFrom<i32> for EmailType {
    type Error = i32;
    fn try_from(v: i32) -> Result<Self, i32> {
        match v {
            0 => Ok(Self::Smtp),
            1 => Ok(Self::OpenId),
            other => Err(other),
        }
    }
}

/// HTTP payload posted to `POST /gen_proof`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenProofRequest {
    /// Raw email (RFC-822 headers + body) — ASCII or UTF-8.
    pub email: String,
    pub email_type: EmailType,
}

/// Redis-stream queue entry. The scheduler crate reads this with
/// `XREADGROUP ... COUNT 1 BLOCK 5000` and kicks off proving.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProveTask {
    /// `keccak256(header_bytes)`, hex-encoded with `0x` — also the
    /// primary key of the `EmailProofs` row. Used by the API layer to
    /// dedupe repeat submissions.
    pub header_hash: String,
    pub email: String,
    pub email_type: EmailType,
}

/// Public stages a task goes through. The ELF used the string literals
/// `pending / proving / finished / failed` in its logs (see rodata).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProveStage {
    Pending,
    Proving,
    Finished,
    Failed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_type_json_is_snake_case() {
        assert_eq!(serde_json::to_string(&EmailType::Smtp).unwrap(), "\"smtp\"");
        assert_eq!(serde_json::to_string(&EmailType::OpenId).unwrap(), "\"open_id\"");
    }

    #[test]
    fn email_type_from_i32_is_total() {
        assert_eq!(EmailType::try_from(0), Ok(EmailType::Smtp));
        assert_eq!(EmailType::try_from(1), Ok(EmailType::OpenId));
        assert_eq!(EmailType::try_from(-1), Err(-1));
        assert_eq!(EmailType::try_from(99), Err(99));
    }

    #[test]
    fn gen_proof_request_round_trip() {
        let req = GenProofRequest {
            email: "From: a@b".into(),
            email_type: EmailType::Smtp,
        };
        let s = serde_json::to_string(&req).unwrap();
        let back: GenProofRequest = serde_json::from_str(&s).unwrap();
        assert_eq!(back.email, req.email);
        assert_eq!(back.email_type, req.email_type);
    }

    #[test]
    fn prove_task_round_trip() {
        let t = ProveTask {
            header_hash: "0xabcd".into(),
            email: "".into(),
            email_type: EmailType::OpenId,
        };
        let s = serde_json::to_string(&t).unwrap();
        let back: ProveTask = serde_json::from_str(&s).unwrap();
        assert_eq!(t, back);
    }

    #[test]
    fn prove_stage_names_match_elf_logs() {
        // Must match the exact strings the ELF writes to its logs — any
        // change here breaks log-ingest dashboards.
        for (st, want) in [
            (ProveStage::Pending, "\"pending\""),
            (ProveStage::Proving, "\"proving\""),
            (ProveStage::Finished, "\"finished\""),
            (ProveStage::Failed, "\"failed\""),
        ] {
            assert_eq!(serde_json::to_string(&st).unwrap(), want);
        }
    }
}
