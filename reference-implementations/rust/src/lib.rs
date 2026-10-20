//! ALX Protocol - Rust implementation.
//!
//! Deterministic infrastructure for verifiable content,
//! interoperable context, and traceable attribution.
//!
//! One primitive: Block = { blockHash, contentHash, parentHashes, content, protocolVersion }
//! Four operations: canonicalize, hash, validate, trace

mod block;
mod canonical;
mod ed25519;
pub mod extensions;
mod graph_validation;
mod lineage;
mod merkle;
mod p256_backend;
mod raw_json;
mod replay;
mod signatures;
mod trace;
mod verification_context;
mod verification_receipt;

pub use block::{
    add_attestation, create_block, create_signed_block, derive_attestation_digest,
    derive_block_hash, derive_content_hash, normalize_hash, normalize_hashes, validate_block,
    validate_block_detailed, validate_signed_block, AttestationValidation, Block, BlockValidation,
    SignedBlock, ATTESTATION_HASH_DOMAIN, BLOCK_HASH_DOMAIN, CONTENT_HASH_DOMAIN, MAX_PARENTS,
};
pub use canonical::canonicalize;
pub use ed25519::{Ed25519Signer, Ed25519Verifier};
pub use graph_validation::{
    validate_graph_verification, GraphLimitReached, GraphValidationIssue, GraphValidationStatus,
    GraphVerification,
};
pub use lineage::{
    add_block_to_graph, build_graph, validate_graph, validate_incremental_block, validate_lineage,
    verify_graph, GraphResult, LineageResult, VerifyIssue, VerifyResult,
};
pub use p256_backend::{P256Signer, P256Verifier};
pub use raw_json::{decode_strict_json_bytes, decode_strict_json_hex};
pub use replay::{build_replay_scope_key, validate_replay_window, ReplayResult};
pub use signatures::{BlockAttestation, Signer, Verifier};
pub use trace::{
    trace_attribution, verify_trace, AttributionTrace, TraceEdge, TraceNode, TraceVerification,
};
pub use verification_context::{ExternalParentBoundary, ValidationMode, VerificationContext};
pub use verification_receipt::{
    validate_receipt, ReceiptBuilder, ReceiptError, VerificationReceipt, VerifierInfo,
};
