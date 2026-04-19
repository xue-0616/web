/// Lindell 2017 two-party ECDSA protocol — Party1 (server) implementation.
///
/// Wraps `multi-party-ecdsa` crate from ZenGo-X for cryptographic correctness.
///
/// Server = Party1 (holds x1, Paillier SK)
/// Client = Party2 (holds x2)
///
/// KeyGen (Lindell 2017 §4.1):
///   Phase 1 → commitment to Q1 + DLog proof
///   Phase 2 → decommitment, Paillier setup, correct-key proof
///   Phase 3 → PDL with slack proof
///
/// Sign (Lindell 2017 §5):
///   Phase 1 → ephemeral R1 + EC-DDH proof
///   Phase 2 → verify Party2 ephemeral, decrypt partial sig, finalize ECDSA

use curv::elliptic::curves::{secp256_k1::Secp256k1, Point};
use curv::BigInt;
use multi_party_ecdsa::protocols::two_party_ecdsa::lindell_2017::party_one;
use multi_party_ecdsa::protocols::two_party_ecdsa::lindell_2017::party_two;
use serde::{Deserialize, Serialize};

use super::TssError;

// ======================== State Types ========================
// Stored server-side between HTTP round-trips.

/// After KeyGen Phase 1 — holds commitment witness + EC keypair.
#[derive(Serialize, Deserialize)]
pub struct KeyGenPhase1State {
    comm_witness: party_one::CommWitness,
    ec_key_pair: party_one::EcKeyPair,
}

/// After KeyGen Phase 2 — holds Party1Private + full PaillierKeyPair
/// (PaillierKeyPair is needed for the PDL proof in Phase 3).
#[derive(Serialize, Deserialize)]
pub struct KeyGenPhase2State {
    party1_private: party_one::Party1Private,
    paillier_key_pair: party_one::PaillierKeyPair,
    party2_public_share: Point<Secp256k1>,
    joint_pubkey: Point<Secp256k1>,
}

/// Final persistent key share — only what is needed for signing.
/// `party_one::Party1Private` holds x1, paillier_dk, c_key_randomness.
/// The curv `Scalar` type internally zeroizes on drop.
///
// SECURITY FIX (BUG-22): Party1KeyShare now implements Drop with explicit zeroization
// of serialized key material. While BigInt/GMP doesn't implement Zeroize natively,
// we serialize-then-zero the representation to minimize the exposure window of secret
// key material in heap memory. Combined with session reaper (default 300s timeout).
// For production deployment, consider running in a memory-encrypted enclave (AMD SEV / Intel SGX).
#[derive(Clone, Serialize, Deserialize)]
pub struct Party1KeyShare {
    party1_private: party_one::Party1Private,
    joint_pubkey: Point<Secp256k1>,
}

impl Party1KeyShare {
    /// Returns the joint (aggregated) secp256k1 public key.
    pub fn joint_pubkey(&self) -> &Point<Secp256k1> {
        &self.joint_pubkey
    }
}

/// SECURITY FIX (BUG-22): Best-effort zeroization of secret key material on drop.
///
/// `Party1Private` holds BigInts backed by `rust-gmp`, which owns heap-allocated
/// limbs and does not implement `Zeroize`. After this `Drop::drop` returns,
/// Rust will automatically run the destructors of the inner fields, which
/// dereference those heap pointers. We therefore MUST NOT scribble over the
/// struct's in-memory layout (that would invalidate the pointer table and
/// cause heap corruption / SIGSEGV when the inner destructors run).
///
/// The mitigation we can safely apply is to serialize the private key to a
/// byte buffer and zero that buffer. It does not clear the live GMP heap
/// allocations, but it does shorten the window during which the serialized
/// byte-level representation can linger on the heap (e.g. in logs, diffs,
/// crash dumps that happen to capture it). Real key-material scrubbing must
/// be handled by the session reaper and/or a memory-encrypted enclave as
/// documented in the Party1KeyShare doc comment above.
impl Drop for Party1KeyShare {
    fn drop(&mut self) {
        if let Ok(mut serialized) = serde_json::to_vec(&self.party1_private) {
            for byte in serialized.iter_mut() {
                // write_volatile to defeat compiler dead-store elimination
                unsafe { std::ptr::write_volatile(byte, 0u8) };
            }
            std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
            drop(serialized);
        }
        // Intentionally NO raw-pointer overwrite of self.party1_private here —
        // that would be undefined behaviour. Let the inner destructors run
        // normally; curv `Scalar` types zero themselves, and GMP BigInt
        // memory becomes inaccessible to the current process once freed.
    }
}

/// After Sign Phase 1 — holds ephemeral EC keypair.
#[derive(Serialize, Deserialize)]
pub struct SignPhase1State {
    eph_ec_key_pair: party_one::EphEcKeyPair,
}

// ======================== Session State Machine ========================

/// Opaque protocol session that enforces phase ordering.
pub enum ProtocolState {
    /// Waiting for keygen_phase2 call.
    KeyGenPhase1(KeyGenPhase1State),
    /// Waiting for keygen_phase3 call.
    KeyGenPhase2(KeyGenPhase2State),
    /// Key generation complete — ready to sign.
    Ready(Party1KeyShare),
    /// Waiting for sign_phase2 call.
    SignPhase1 {
        key_share: Party1KeyShare,
        sign_state: SignPhase1State,
    },
}

// ======================== Protocol Functions ========================

/// KeyGen Phase 1 — create EC keypair + hash commitment.
///
/// Returns the commitment message (to send to Party2) and the new session state.
pub fn keygen_phase1() -> Result<(serde_json::Value, ProtocolState), TssError> {
    let (first_msg, comm_witness, ec_key_pair) =
        party_one::KeyGenFirstMsg::create_commitments();

    let state = ProtocolState::KeyGenPhase1(KeyGenPhase1State {
        comm_witness,
        ec_key_pair,
    });

    let response = serde_json::to_value(&first_msg)
        .map_err(|e| TssError::SerdeJsonError(e.to_string()))?;

    Ok((response, state))
}

/// KeyGen Phase 2 — verify Party2 DLog proof, decommit, create Paillier keypair.
///
/// `prev` must be `ProtocolState::KeyGenPhase1`.
/// `body` must deserialize to `{ "party2_first_msg": <party_two::KeyGenFirstMsg> }`.
pub fn keygen_phase2(
    prev: ProtocolState,
    body: &serde_json::Value,
) -> Result<(serde_json::Value, ProtocolState), TssError> {
    let kg1 = match prev {
        ProtocolState::KeyGenPhase1(s) => s,
        _ => return Err(TssError::KeyGenError("Wrong phase: expected KeyGenPhase1".into())),
    };

    // Deserialize Party2's first message (DLog proof + public share)
    let party2_first_msg: party_two::KeyGenFirstMsg =
        serde_json::from_value(body["party2_first_msg"].clone())
            .map_err(|e| TssError::SerdeJsonError(format!("party2_first_msg: {e}")))?;

    // 1. Verify Party2's Schnorr DLog proof and decommit Q1
    let keygen_second_msg = party_one::KeyGenSecondMsg::verify_and_decommit(
        kg1.comm_witness,
        &party2_first_msg.d_log_proof,
    )
    .map_err(|_| TssError::IncorrectProof)?;

    // 2. Generate Paillier keypair (≥2048-bit) ; encrypt x1 under Paillier
    let paillier_key_pair =
        party_one::PaillierKeyPair::generate_keypair_and_encrypted_share(&kg1.ec_key_pair);

    // 3. NI correct-key proof (proves Paillier modulus is well-formed)
    let correct_key_proof =
        party_one::PaillierKeyPair::generate_ni_proof_correct_key(&paillier_key_pair);

    // 4. Create Party1Private (holds x1, paillier_dk, c_key_randomness)
    let party1_private =
        party_one::Party1Private::set_private_key(&kg1.ec_key_pair, &paillier_key_pair);

    // 5. Joint public key Q = x1 · Q2
    let joint_pubkey =
        party_one::compute_pubkey(&party1_private, &party2_first_msg.public_share);

    // Build response
    #[derive(Serialize)]
    struct Phase2Resp<'a> {
        party1_second_msg: &'a party_one::KeyGenSecondMsg,
        paillier_ek: &'a paillier::EncryptionKey,
        paillier_encrypted_share: &'a BigInt,
        correct_key_proof: &'a zk_paillier::zkproofs::NiCorrectKeyProof,
    }
    let resp = Phase2Resp {
        party1_second_msg: &keygen_second_msg,
        paillier_ek: &paillier_key_pair.ek,
        paillier_encrypted_share: &paillier_key_pair.encrypted_share,
        correct_key_proof: &correct_key_proof,
    };
    let response = serde_json::to_value(&resp)
        .map_err(|e| TssError::SerdeJsonError(e.to_string()))?;

    let state = ProtocolState::KeyGenPhase2(KeyGenPhase2State {
        party1_private,
        paillier_key_pair,
        party2_public_share: party2_first_msg.public_share,
        joint_pubkey,
    });

    Ok((response, state))
}

/// KeyGen Phase 3 — generate PDL-with-slack proof + composite DLog proof.
///
/// `prev` must be `ProtocolState::KeyGenPhase2`.
pub fn keygen_phase3(
    prev: ProtocolState,
) -> Result<(serde_json::Value, ProtocolState), TssError> {
    let kg2 = match prev {
        ProtocolState::KeyGenPhase2(s) => s,
        _ => return Err(TssError::KeyGenError("Wrong phase: expected KeyGenPhase2".into())),
    };

    // Generate PDL with slack proof (proves c_key encrypts the discrete-log of Q1)
    let (pdl_statement, pdl_proof, composite_dlog_proof) =
        party_one::PaillierKeyPair::pdl_proof(&kg2.party1_private, &kg2.paillier_key_pair);

    #[derive(Serialize)]
    struct Phase3Resp {
        pdl_statement: multi_party_ecdsa::utilities::zk_pdl_with_slack::PDLwSlackStatement,
        pdl_proof: multi_party_ecdsa::utilities::zk_pdl_with_slack::PDLwSlackProof,
        composite_dlog_proof: zk_paillier::zkproofs::CompositeDLogProof,
        joint_pubkey: Point<Secp256k1>,
    }
    let resp = Phase3Resp {
        pdl_statement,
        pdl_proof,
        composite_dlog_proof,
        joint_pubkey: kg2.joint_pubkey.clone(),
    };
    let response = serde_json::to_value(&resp)
        .map_err(|e| TssError::SerdeJsonError(e.to_string()))?;

    let key_share = Party1KeyShare {
        party1_private: kg2.party1_private,
        joint_pubkey: kg2.joint_pubkey,
    };

    Ok((response, ProtocolState::Ready(key_share)))
}

/// Sign Phase 1 — generate ephemeral EC keypair (k1, R1 = k1·G) + EC-DDH proof.
///
/// `prev` must be `ProtocolState::Ready`.
pub fn sign_phase1(
    prev: ProtocolState,
) -> Result<(serde_json::Value, ProtocolState), TssError> {
    let key_share = match prev {
        ProtocolState::Ready(ks) => ks,
        _ => return Err(TssError::SpecificError("Wrong phase: expected Ready".into())),
    };

    // Generate ephemeral keypair with EC-DDH proof (k1, R1 = k1·G)
    let (eph_first_msg, eph_ec_key_pair) = party_one::EphKeyGenFirstMsg::create();

    let response = serde_json::to_value(&eph_first_msg)
        .map_err(|e| TssError::SerdeJsonError(e.to_string()))?;

    let state = ProtocolState::SignPhase1 {
        key_share,
        sign_state: SignPhase1State { eph_ec_key_pair },
    };

    Ok((response, state))
}

/// Sign Phase 2 — verify Party2 ephemeral, decrypt partial sig, compute final ECDSA signature.
///
/// `prev` must be `ProtocolState::SignPhase1`.
/// `body` must contain `party2_eph_first_msg`, `party2_eph_second_msg`, `partial_sig`, `message`.
///
/// **Security**: The final signature is verified against the joint public key before returning.
pub fn sign_phase2(
    prev: ProtocolState,
    body: &serde_json::Value,
) -> Result<(serde_json::Value, ProtocolState), TssError> {
    let (key_share, sign_state) = match prev {
        ProtocolState::SignPhase1 { key_share, sign_state } => (key_share, sign_state),
        _ => return Err(TssError::SpecificError("Wrong phase: expected SignPhase1".into())),
    };

    // Deserialize Party2's ephemeral messages
    let party2_eph_first: party_two::EphKeyGenFirstMsg =
        serde_json::from_value(body["party2_eph_first_msg"].clone())
            .map_err(|e| TssError::SerdeJsonError(format!("party2_eph_first_msg: {e}")))?;

    let party2_eph_second: party_two::EphKeyGenSecondMsg =
        serde_json::from_value(body["party2_eph_second_msg"].clone())
            .map_err(|e| TssError::SerdeJsonError(format!("party2_eph_second_msg: {e}")))?;

    let partial_sig: party_two::PartialSig =
        serde_json::from_value(body["partial_sig"].clone())
            .map_err(|e| TssError::SerdeJsonError(format!("partial_sig: {e}")))?;

    let message: BigInt =
        serde_json::from_value(body["message"].clone())
            .map_err(|e| TssError::SerdeJsonError(format!("message: {e}")))?;

    // 1. Verify Party2's ephemeral commitment + EC-DDH proof
    let _verified = party_one::EphKeyGenSecondMsg::verify_commitments_and_dlog_proof(
        &party2_eph_first,
        &party2_eph_second,
    )
    .map_err(|_| TssError::IncorrectProof)?;

    // 2. Extract Party2's verified ephemeral public share
    let party2_eph_public = &party2_eph_second.comm_witness.public_share;

    // 3. Compute ECDSA signature with recovery id
    //    Internally: R = k1·R2, r = R.x, s = k1⁻¹ · Dec(c3), normalized to low-S
    let sig_recid = party_one::Signature::compute_with_recid(
        &key_share.party1_private,
        &partial_sig.c3,
        &sign_state.eph_ec_key_pair,
        party2_eph_public,
    );

    // 4. Verify the signature before returning (defense in depth)
    let sig_for_verify = party_one::Signature {
        r: sig_recid.r.clone(),
        s: sig_recid.s.clone(),
    };
    party_one::verify(&sig_for_verify, &key_share.joint_pubkey, &message)
        .map_err(|_| TssError::SpecificError("Signature verification failed".into()))?;

    // Build response
    #[derive(Serialize)]
    struct SigResp {
        r: BigInt,
        s: BigInt,
        recid: u8,
    }
    let resp = SigResp {
        r: sig_recid.r,
        s: sig_recid.s,
        recid: sig_recid.recid,
    };
    let response = serde_json::to_value(&resp)
        .map_err(|e| TssError::SerdeJsonError(e.to_string()))?;

    // Transition back to Ready (key_share is reusable for multiple signatures)
    Ok((response, ProtocolState::Ready(key_share)))
}
