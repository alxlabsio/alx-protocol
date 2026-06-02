/**
 * block.ts — ALX Protocol core primitive.
 *
 * A block is a content-addressed container with lineage.
 * The protocol does not interpret content. It hashes, links, and verifies.
 *
 * Block = { blockHash, contentHash, parentHashes, content }
 *
 *   blockHash   = keccak256(canonicalize({ content, parentHashes }))
 *   contentHash = keccak256(canonicalize(content))
 *
 * Invariants:
 *   1. Same content + same parents → same blockHash (deterministic)
 *   2. Hash is irreversible (keccak-256)
 *   3. parentHashes are normalized, sorted, and deduplicated (canonical ordering)
 *   4. parentHashes are an unordered dependency set — order is a content-level concern
 *   5. Content is opaque (the protocol never inspects it)
 *   6. null and undefined content are equivalent (both canonicalize to "null")
 *   7. Attestations are optional extension data, orthogonal to block identity, and excluded from hash computation
 */

import { canonicalizeProtocolJson } from "./canonicalization.js";
import { normalizeHash, normalizeHashes, compareHashesConstantTime, hexToBytes } from "./hash-utils.js";
import { ErrorCode, protocolError } from "./errors.js";
import type { Signer, Verifier, BlockAttestation } from "./signatures.js";
import sha3pkg from "js-sha3";

const { keccak_256 } = sha3pkg;

export { normalizeHash, normalizeHashes } from "./hash-utils.js";

/** A content-addressed container with lineage. */
export interface Block {
  blockHash: string;
  contentHash: string;
  parentHashes: string[];
  content: unknown;
  /** Protocol algorithm version. Excluded from hash derivation. Absent means "1". */
  protocolVersion?: string;
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

/** Result of block validation. */
export interface BlockValidation {
  ok: boolean;
  expected: string;
  actual: string;
  expectedContentHash?: string;
  actualContentHash?: string;
  canonicalParents?: string[];
  parentsCanonical?: boolean;
  selfRef?: boolean;
  /** First attestation result (backwards compatible). */
  attestation?: AttestationValidation;
  /** All attestation results. */
  attestations?: AttestationValidation[];
}

/**
 * Derive a deterministic block hash from content and lineage.
 *
 * blockHash = keccak256(canonicalize({ content, parentHashes }))
 */
export function deriveBlockHash(content: unknown, parentHashes?: string[]): string {
  return "0x" + keccak_256(canonicalizeProtocolJson({
    content: content ?? null,
    parentHashes: normalizeHashes(parentHashes),
  }));
}

/**
 * Derive a content hash (without lineage).
 *
 * contentHash = keccak256(canonicalize(content))
 */
export function deriveContentHash(content: unknown): string {
  return "0x" + keccak_256(canonicalizeProtocolJson(content ?? null));
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
    content:         content ?? null,
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

  const hashBytes = hexToBytes(blockHash);
  const signature = await signer.sign(hashBytes);
  const attester = await signer.getId();

  return {
    blockHash,
    attester,
    algorithm: signer.algorithm,
    timestamp: ts,
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
  if (block.protocolVersion !== undefined && block.protocolVersion !== "1") {
    throw protocolError(ErrorCode.UNSUPPORTED_VERSION,
      `Unsupported protocolVersion: "${block.protocolVersion}". Only "1" is recognized.`);
  }
  const canonicalParents = normalizeHashes(block.parentHashes);
  const expected = deriveBlockHash(block.content, block.parentHashes);
  const actual = normalizeHash(block.blockHash);
  const expectedContentHash = deriveContentHash(block.content);
  const actualContentHash = normalizeHash(block.contentHash);
  const parentsCanonical = JSON.stringify(block.parentHashes) === JSON.stringify(canonicalParents);
  const selfRef = canonicalParents.includes(actual);
  return {
    ok:
      compareHashesConstantTime(expected, actual) &&
      compareHashesConstantTime(expectedContentHash, actualContentHash) &&
      parentsCanonical &&
      !selfRef,
    expected,
    actual,
    expectedContentHash,
    actualContentHash,
    canonicalParents,
    parentsCanonical,
    selfRef,
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
  const hashBytes = hexToBytes(signedBlock.block.blockHash);

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
    const sigResult = await v.verify(hashBytes, att.signature, att.attester);
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
