"""
ALX Protocol - Python implementation.

Deterministic infrastructure for verifiable content,
interoperable context, and traceable attribution.

One primitive: Block = { blockHash, contentHash, parentHashes, content }
Four operations: canonicalize, hash, validate, trace
"""

from alx_protocol.canonical import canonicalize
from alx_protocol.block import (
    derive_block_hash,
    derive_content_hash,
    create_block,
    create_signed_block,
    add_attestation,
    validate_block,
    validate_signed_block,
    normalize_hash,
    normalize_hashes,
    MAX_PARENTS,
)
from alx_protocol.lineage import (
    validate_lineage,
    validate_graph,
    build_graph,
    verify_graph,
    add_block_to_graph,
    validate_incremental_block,
)
from alx_protocol.trace import trace_attribution, verify_trace
from alx_protocol.replay import build_replay_scope_key, validate_replay_window
from alx_protocol.signatures import BlockAttestation, Signer, Verifier
from alx_protocol.ed25519 import Ed25519Signer, Ed25519Verifier
from alx_protocol.p256 import P256Signer, P256Verifier
from alx_protocol.verification_context import ExternalParentBoundary, VerificationContext
from alx_protocol.verification_receipt import build_receipt, validate_receipt

__version__ = "1.0.0"

__all__ = [
    "__version__",
    "canonicalize",
    "derive_block_hash", "derive_content_hash", "create_block", "create_signed_block",
    "add_attestation", "validate_block", "validate_signed_block",
    "normalize_hash", "normalize_hashes",
    "MAX_PARENTS",
    "validate_lineage", "validate_graph", "build_graph", "verify_graph",
    "add_block_to_graph", "validate_incremental_block",
    "trace_attribution", "verify_trace",
    "build_replay_scope_key", "validate_replay_window",
    "BlockAttestation", "Signer", "Verifier",
    "Ed25519Signer", "Ed25519Verifier", "P256Signer", "P256Verifier",
    "ExternalParentBoundary", "VerificationContext",
    "build_receipt", "validate_receipt",
]

