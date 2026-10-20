"""
ALX Protocol - Python implementation.

Deterministic infrastructure for verifiable content,
interoperable context, and traceable attribution.

One primitive: Block = { blockHash, contentHash, parentHashes, content, protocolVersion }
Four operations: canonicalize, hash, validate, trace
"""

from alx_protocol.block import (
    ATTESTATION_HASH_DOMAIN,
    BLOCK_HASH_DOMAIN,
    CONTENT_HASH_DOMAIN,
    MAX_PARENTS,
    add_attestation,
    create_block,
    create_signed_block,
    derive_attestation_digest,
    derive_block_hash,
    derive_content_hash,
    normalize_hash,
    normalize_hashes,
    validate_block,
    validate_signed_block,
)
from alx_protocol.canonical import canonicalize
from alx_protocol.ed25519 import Ed25519Signer, Ed25519Verifier
from alx_protocol.lineage import (
    add_block_to_graph,
    build_graph,
    validate_graph,
    validate_graph_structure,
    validate_incremental_block,
    validate_lineage,
    verify_graph,
)
from alx_protocol.p256 import P256Signer, P256Verifier
from alx_protocol.raw_json import decode_strict_json_bytes, decode_strict_json_hex
from alx_protocol.replay import build_replay_scope_key, validate_replay_window
from alx_protocol.signatures import BlockAttestation, Signer, Verifier
from alx_protocol.trace import trace_attribution, verify_trace
from alx_protocol.verification_context import (
    ExternalParentBoundary,
    GraphLimitReached,
    GraphValidationIssue,
    GraphValidationStatus,
    GraphVerification,
    ResourceLimits,
    VerificationContext,
)
from alx_protocol.verification_receipt import build_receipt, validate_receipt

from alx_protocol._version import __version__

__all__ = [
    "__version__",
    "canonicalize",
    "derive_block_hash", "derive_content_hash", "derive_attestation_digest",
    "CONTENT_HASH_DOMAIN", "BLOCK_HASH_DOMAIN", "ATTESTATION_HASH_DOMAIN",
    "create_block", "create_signed_block",
    "add_attestation", "validate_block", "validate_signed_block",
    "normalize_hash", "normalize_hashes",
    "MAX_PARENTS",
    "validate_lineage", "validate_graph", "validate_graph_structure", "build_graph", "verify_graph",
    "add_block_to_graph", "validate_incremental_block",
    "trace_attribution", "verify_trace",
    "build_replay_scope_key", "validate_replay_window",
    "BlockAttestation", "Signer", "Verifier",
    "Ed25519Signer", "Ed25519Verifier", "P256Signer", "P256Verifier",
    "decode_strict_json_bytes", "decode_strict_json_hex",
    "ExternalParentBoundary", "ResourceLimits", "VerificationContext",
    "GraphValidationStatus", "GraphValidationIssue", "GraphLimitReached", "GraphVerification",
    "build_receipt", "validate_receipt",
]

