/**
 * ALX Protocol
 *
 * Deterministic infrastructure for verifiable content,
 * interoperable context, and traceable attribution.
 *
 * One primitive: Block = { blockHash, contentHash, parentHashes, content }
 * Four operations: canonicalize, hash, validate, trace
 *
 * The protocol does not interpret content. It hashes, links,
 * validates, and traces. Everything else is application-level.
 */

export const ALX_PROTOCOL_VERSION = "1" as const;

// ── Error codes ────────────────────────────────────────────────────────────

export { ErrorCode, protocolError } from "./errors.js";
export type { ErrorCodeValue } from "./errors.js";

// ── Layer 1: Canonicalize ───────────────────────────────────────────────────

export {
  canonicalizeProtocolJson,
  CANONICALIZATION_ALGORITHM,
} from "./canonicalization.js";

// ── Hash utilities ─────────────────────────────────────────────────────────

export {
  HASH_PATTERN,
  MAX_PARENTS,
  normalizeHash,
  normalizeHashLenient,
  normalizeHashes,
  compareHashesConstantTime,
  hexToBytes,
  bytesToHex,
  concatBytes,
} from "./hash-utils.js";

// ── Layer 2: Hash ───────────────────────────────────────────────────────────

export {
  deriveBlockHash,
  deriveContentHash,
  createBlock,
  lock,
  createSignedBlock,
  addAttestation,
  validateBlock,
  validateSignedBlock,
} from "./block.js";

export type { Block, SignedBlock, BlockValidation, AttestationValidation } from "./block.js";

// ── Layer 3: Validate ───────────────────────────────────────────────────────

export {
  validateLineage,
  validateGraph,
  buildGraph,
  verifyGraph,
  addBlockToGraph,
  validateIncrementalBlock,
} from "./block-lineage.js";

export type { LineageResult, GraphResult, VerifyResult } from "./block-lineage.js";

// ── Layer 4: Trace ──────────────────────────────────────────────────────────
// Given a root block and a graph, resolve the full lineage structure.
// Returns nodes, edges, depths, path counts — not economics.

export {
  traceAttribution,
  verifyTrace,
} from "./block-trace.js";

export type { TraceNode, TraceEdge, AttributionTrace, TraceVerification } from "./block-trace.js";
export type {
  ExternalParentBoundary,
  ValidationMode,
  VerificationContext,
} from "./verification-context.js";

// ── Merkle (checkpoint proofs) ───────────────────────────────────────────────
// Off-chain Merkle tree for generating inclusion proofs verified on-chain
// by CheckpointRegistry.verifyInclusion.


// ── Signing (orthogonal) ────────────────────────────────────────────────────

export {
  signBlock,
  verifyBlockSignature,
  BLOCK_ATTESTATION_TYPES,
  PROTOCOL_SIGNED_REQUEST_TYPES,
  PROTOCOL_SIGNING_DOMAIN_NAME,
  PROTOCOL_SIGNING_DOMAIN_VERSION,
} from "./signatures.js";

export type { Signer, Verifier, NormalizedPayload, VerificationResult, BlockAttestation } from "./signatures.js";

// ── Protocol payload (EIP-712 domain + signed request verification) ────────

export {
  buildProtocolSigningDomain,
  verifySignedProtocolPayload,
  normalizeSignedProtocolPayload,
} from "./protocol-payload.js";

// ── Built-in Signer/Verifier implementations ──────────────────────────────

export {
  Eip712Signer,
  Eip712Verifier,
} from "./eip712.js";

export {
  Ed25519Signer,
  Ed25519Verifier,
} from "./ed25519.js";

export {
  P256Signer,
  P256Verifier,
} from "./p256.js";

export {
  buildReplayScopeKey,
  validateReplayWindow,
} from "./replay.js";

export type { ReplayResult } from "./replay.js";
