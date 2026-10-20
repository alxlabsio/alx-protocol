/**
 * block.ts — ALX Protocol core primitive.
 *
 * A block is a content-addressed container with lineage.
 * The protocol does not interpret content. It hashes, links, and verifies.
 *
 * Block = { blockHash, contentHash, parentHashes, content, protocolVersion }
 *
 *   blockHash   = keccak256("ALX-BLOCK-V1\0" || canonicalize({ content, parentHashes }))
 *   contentHash = keccak256("ALX-CONTENT-V1\0" || canonicalize(content))
 *
 * Invariants:
 *   1. Same content + same parents → same blockHash (deterministic)
 *   2. Block and content hashes occupy distinct v1 domains
 *   3. parentHashes are normalized, sorted, and deduplicated (canonical ordering)
 *   4. parentHashes are an unordered dependency set — order is a content-level concern
 *   5. Content semantics are opaque; canonicalization validates its ALX value structure
 *   6. undefined and other non-ALX values are rejected
 *   7. Attestations are optional extension data, orthogonal to block identity, and excluded from hash computation
 */

import { canonicalizeProtocolJson } from "./canonicalization.js";
import { normalizeHash, normalizeHashes, compareHashesConstantTime, hexToBytes } from "./hash-utils.js";
import { ErrorCode, protocolError } from "./errors.js";
import type { Signer, Verifier, BlockAttestation } from "./signatures.js";
import sha3pkg from "js-sha3";

const { keccak_256 } = sha3pkg;

export const CONTENT_HASH_DOMAIN = "ALX-CONTENT-V1\0" as const;
export const BLOCK_HASH_DOMAIN = "ALX-BLOCK-V1\0" as const;
export const ATTESTATION_HASH_DOMAIN = "ALX-ATTESTATION-V1\0" as const;

export {
  normalizeHash,
  normalizeHashes,
  sanitizeImportedParentHashes,
} from "./hash-utils.js";
export type {
  RejectedParentHashReason,
  RejectedParentHash,
  DuplicateParentHash,
  ParentHashCollectionError,
  SanitizedParentHashes,
} from "./hash-utils.js";

/** A content-addressed container with lineage. */
export interface Block {
  blockHash: string;
  contentHash: string;
  parentHashes: string[];
  content: unknown;
  /** Required protocol algorithm version. Excluded from hash derivation. */
  protocolVersion: "1";
}

/** Optional signing-extension wrapper around a core Block. */
export interface SignedBlock {
  block: Block;
  /** @deprecated Use `attestations` instead. Will be removed in v2.0. */
  attestation?: BlockAttestation;
  attestations?: BlockAttestation[];
}

/** Result of validating a single attestation. */
export interface AttestationValidation {
  ok: boolean;
  attester: string;
  algorithm: string;
  reason?: string;
}

/** Comparison between a stored hash and the value recomputed during validation. */
export interface HashValidationResult {
  stored: string;
  recomputed: string;
  match: boolean;
}

/** Result of Block validation. */
export interface BlockValidation {
  ok: boolean;
  /** Recomputed blockHash. Retained for backward compatibility. */
  expected: string;
  /** Normalized stored blockHash. Retained for backward compatibility. */
  actual: string;
  expectedContentHash?: string;
  actualContentHash?: string;
  canonicalParents?: string[];
  parentsCanonical?: boolean;
  selfRef?: boolean;
  /** Structured comparison for full Block identity. */
  blockHash: HashValidationResult;
  /** Structured comparison for content-only identity. */
  contentHash: HashValidationResult;
  /** First attestation result (backwards compatible). */
  attestation?: AttestationValidation;
  /** All attestation results. */
  attestations?: AttestationValidation[];
}

/**
 * Derive a deterministic block hash from content and lineage.
 *
 * blockHash = keccak256("ALX-BLOCK-V1\0" || canonicalize({ content, parentHashes }))
 */
export function deriveBlockHash(content: unknown, parentHashes?: string[]): string {
  const canonical = canonicalizeProtocolJson({
    content,
    parentHashes: normalizeHashes(parentHashes),
  });
  return "0x" + keccak_256(BLOCK_HASH_DOMAIN + canonical);
}

/**
 * Derive a content hash (without lineage).
 *
 * contentHash = keccak256("ALX-CONTENT-V1\0" || canonicalize(content))
 */
export function deriveContentHash(content: unknown): string {
  return "0x" + keccak_256(CONTENT_HASH_DOMAIN + canonicalizeProtocolJson(content));
}

/** Derive the authenticated digest for a portable Block attestation. */
export function deriveAttestationDigest(input: Omit<BlockAttestation, "signature">): Uint8Array {
  const canonical = canonicalizeProtocolJson({
    algorithm: input.algorithm,
    attester: input.attester,
    blockHash: normalizeHash(input.blockHash),
    timestamp: input.timestamp,
  });
  return hexToBytes("0x" + keccak_256(ATTESTATION_HASH_DOMAIN + canonical));
}

/**
 * Create a block (synchronous, unsigned).
 */
export function createBlock(content: unknown, parentHashes?: string[]): Block {
  const parents = normalizeHashes(parentHashes);
  return {
    blockHash:       deriveBlockHash(content, parents),
    contentHash:     deriveContentHash(content),
    parentHashes:    parents,
    content,
    protocolVersion: "1",
  };
}

/**
 * Lock any value into a Block.
 *
 * Ergonomic alias for `createBlock` — designed for the common in-process
 * pipeline pattern where you have an object in memory and want to lock it
 * into the chain in one call.
 *
 * @example
 * const responseBlock = lock(
 *   { type: "ai.response", text: response.content, model: "your-model-id" },
 *   { parents: [promptBlock] }
 * );
 */
export function lock(
  content: unknown,
  opts?: { parents?: Block[] | string[] },
): Block {
  const rawParents = opts?.parents ?? [];
  const parentHashes = rawParents.map((p) =>
    typeof p === "string" ? p : (p as Block).blockHash,
  );
  return createBlock(content, parentHashes);
}

/** Build an attestation from a signer. */
async function buildAttestation(blockHash: string, signer: Signer, timestamp?: number): Promise<BlockAttestation> {
  if (typeof signer.algorithm !== "string" || signer.algorithm.length === 0) {
    throw protocolError(ErrorCode.INVALID_ALGORITHM, "signer.algorithm must be a non-empty string");
  }

  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(ts) || ts < 0) {
    throw protocolError(ErrorCode.INVALID_TIMESTAMP, "timestamp must be a non-negative safe integer");
  }

  const attester = await signer.getId();
  if (typeof attester !== "string" || attester.length === 0) {
    throw protocolError(ErrorCode.INVALID_KEY, "signer identifier must be a non-empty string");
  }
  const payload = {
    blockHash,
    attester,
    algorithm: signer.algorithm,
    timestamp: ts,
  };
  const signature = await signer.sign(deriveAttestationDigest(payload));

  return {
    ...payload,
    signature,
  };
}

/**
 * Create a signed block with authorship attestation.
 *
 * Computes the same blockHash as createBlock (deterministic, unchanged),
 * then signs it with the provided signer and attaches the attestation.
 */
export async function createSignedBlock(
  content: unknown,
  parentHashes: string[] | undefined,
  signer: Signer,
  timestamp?: number,
): Promise<SignedBlock> {
  const block = createBlock(content, parentHashes);
  const att = await buildAttestation(block.blockHash, signer, timestamp);

  return { block, attestation: att, attestations: [att] };
}

/**
 * Add an attestation to an existing block. Appends to the attestations array.
 * Does not change blockHash (attestations are orthogonal to identity).
 */
export async function addAttestation(
  signedBlock: SignedBlock,
  signer: Signer,
  timestamp?: number,
): Promise<SignedBlock> {
  const att = await buildAttestation(signedBlock.block.blockHash, signer, timestamp);
  const existing = signedBlock.attestations ?? (signedBlock.attestation ? [signedBlock.attestation] : []);
  const attestations = [...existing, att];

  return { ...signedBlock, attestation: attestations[0], attestations };
}

/** Get all attestations from a block, handling both singular and plural fields. */
function getAttestations(signedBlock: SignedBlock): BlockAttestation[] {
  if (signedBlock.attestations && signedBlock.attestations.length > 0) return signedBlock.attestations;
  if (signedBlock.attestation) return [signedBlock.attestation];
  return [];
}

/**
 * Validate that a block's hash matches its content and parents (synchronous, hash-only).
 */
export function validateBlock(block: Block): BlockValidation {
  if (block === null || typeof block !== "object" || Array.isArray(block)) {
    throw protocolError(ErrorCode.SCHEMA_INVALID, "Block must be an object");
  }
  const fields = Object.keys(block).sort();
  const requiredFields = ["blockHash", "content", "contentHash", "parentHashes", "protocolVersion"];
  if (JSON.stringify(fields) !== JSON.stringify(requiredFields)
      || typeof block.blockHash !== "string"
      || typeof block.contentHash !== "string"
      || !Array.isArray(block.parentHashes)
      || !Object.prototype.hasOwnProperty.call(block, "content")
      || typeof block.protocolVersion !== "string") {
    throw protocolError(ErrorCode.SCHEMA_INVALID, "Block fields do not match the core Block schema");
  }
  if (block.protocolVersion !== "1") {
    throw protocolError(ErrorCode.UNSUPPORTED_VERSION,
      `Unsupported protocolVersion: "${block.protocolVersion}". Only "1" is recognized.`);
  }
  const canonicalParents = normalizeHashes(block.parentHashes);
  const expected = deriveBlockHash(block.content, block.parentHashes);
  const actual = normalizeHash(block.blockHash);
  const expectedContentHash = deriveContentHash(block.content);
  const actualContentHash = normalizeHash(block.contentHash);
  const blockHashDigestMatch = compareHashesConstantTime(expected, actual);
  const contentHashDigestMatch = compareHashesConstantTime(expectedContentHash, actualContentHash);
  const blockHashMatch = block.blockHash === actual && blockHashDigestMatch;
  const contentHashMatch = block.contentHash === actualContentHash && contentHashDigestMatch;
  const parentsCanonical = JSON.stringify(block.parentHashes) === JSON.stringify(canonicalParents);
  const selfRef = canonicalParents.includes(actual);
  return {
    ok:
      blockHashMatch &&
      contentHashMatch &&
      parentsCanonical &&
      !selfRef,
    expected,
    actual,
    expectedContentHash,
    actualContentHash,
    canonicalParents,
    parentsCanonical,
    selfRef,
    blockHash: {
      stored: actual,
      recomputed: expected,
      match: blockHashMatch,
    },
    contentHash: {
      stored: actualContentHash,
      recomputed: expectedContentHash,
      match: contentHashMatch,
    },
  };
}

/**
 * Validate a block's hash AND verify its attestation signatures.
 *
 * Accepts either a single Verifier (checks all attestations with that algorithm)
 * or a Map<string, Verifier> (algorithm → verifier) for multi-algorithm blocks.
 */
export async function validateSignedBlock(
  signedBlock: SignedBlock,
  verifier: Verifier | Map<string, Verifier>,
): Promise<BlockValidation> {
  const hashResult = validateBlock(signedBlock.block);
  const attestations = getAttestations(signedBlock);

  if (attestations.length === 0) {
    return {
      ...hashResult,
      ok: false,
      attestation: { ok: false, attester: "", algorithm: "", reason: "no attestation present" },
      attestations: [],
    };
  }

  const results: AttestationValidation[] = [];
  for (const att of attestations) {
    // Check blockHash matches
    if (att.blockHash !== signedBlock.block.blockHash) {
      results.push({ ok: false, attester: att.attester, algorithm: att.algorithm, reason: "attestation.blockHash does not match block.blockHash" });
      continue;
    }

    // Validate attestation timestamp
    if (!Number.isSafeInteger(att.timestamp) || att.timestamp < 0) {
      results.push({ ok: false, attester: att.attester, algorithm: att.algorithm, reason: "attestation.timestamp must be a non-negative safe integer" });
      continue;
    }

    // Resolve verifier for this attestation's algorithm
    const v = verifier instanceof Map ? verifier.get(att.algorithm) : (verifier.algorithm === att.algorithm ? verifier : null);
    if (!v) {
      results.push({ ok: false, attester: att.attester, algorithm: att.algorithm, reason: `no verifier for algorithm "${att.algorithm}"` });
      continue;
    }

    // Verify signature
    const sigResult = await v.verify(deriveAttestationDigest({
      blockHash: att.blockHash,
      attester: att.attester,
      algorithm: att.algorithm,
      timestamp: att.timestamp,
    }), att.signature, att.attester);
    results.push({
      ok: sigResult.ok,
      attester: sigResult.signer || att.attester,
      algorithm: att.algorithm,
      reason: sigResult.ok ? undefined : "signature verification failed",
    });
  }

  const allOk = results.every(r => r.ok);

  return {
    ...hashResult,
    ok: hashResult.ok && allOk,
    attestation: results[0],
    attestations: results,
  };
}
