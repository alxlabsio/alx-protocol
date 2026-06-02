//! ALX Protocol - Rust implementation.
//!
//! Deterministic infrastructure for verifiable content,
//! interoperable context, and traceable attribution.
//!
//! One primitive: Block = { blockHash, contentHash, parentHashes, content }
//! Four operations: canonicalize, hash, validate, trace

mod canonical;
mod block;
mod lineage;
mod trace;
mod merkle;
mod signatures;
mod ed25519;
mod p256_backend;
mod replay;
mod verification_context;
mod verification_receipt;
pub mod extensions;

pub use canonical::canonicalize;
pub use block::{derive_block_hash, derive_content_hash, create_block, create_signed_block, add_attestation, validate_block, validate_block_detailed, validate_signed_block, normalize_hash, normalize_hashes, MAX_PARENTS, Block, SignedBlock, AttestationValidation, BlockValidation};
pub use lineage::{validate_lineage, validate_graph, build_graph, verify_graph, add_block_to_graph, validate_incremental_block, LineageResult, GraphResult, VerifyIssue, VerifyResult};
pub use trace::{trace_attribution, verify_trace, AttributionTrace, TraceNode, TraceEdge, TraceVerification};
pub use signatures::{BlockAttestation, Signer, Verifier};
pub use ed25519::{Ed25519Signer, Ed25519Verifier};
pub use p256_backend::{P256Signer, P256Verifier};
pub use replay::{build_replay_scope_key, validate_replay_window, ReplayResult};
pub use verification_context::{ExternalParentBoundary, ValidationMode, VerificationContext};
pub use verification_receipt::{VerificationReceipt, VerifierInfo, ReceiptError, ReceiptBuilder, validate_receipt};

