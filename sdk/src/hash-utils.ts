/**
 * Shared hash normalization for ALX Protocol.
 */

import { ErrorCode, protocolError } from "./errors.js";

/** Matches a valid 0x-prefixed, lowercase, 64-character hexadecimal hash. */
export const HASH_PATTERN = /^0x[a-f0-9]{64}$/;

/** Maximum number of normalized parent hashes per Block. */
export const MAX_PARENTS = 256;

/** Reason an imported parent-hash value was rejected. */
export type RejectedParentHashReason = "not_array" | "invalid_type" | "invalid_format";

/** Rejected collection or entry reported by the import-boundary sanitizer. */
export interface RejectedParentHash {
  index: number | null;
  value: unknown;
  reason: RejectedParentHashReason;
}

/** Duplicate entry reported after parent-hash normalization. */
export interface DuplicateParentHash {
  index: number;
  hash: string;
}

/** Collection-level sanitizer diagnostic. */
export interface ParentHashCollectionError {
  reason: "too_many_parents";
  count: number;
  maximum: number;
}

/** Result of tolerant parent-hash inspection at an import boundary. */
export interface SanitizedParentHashes {
  /**
   * True when the normalized result can be passed to the strict core.
   * Duplicate entries do not make the result unusable.
   */
  ok: boolean;
  /** Sorted unique valid entries. May exceed MAX_PARENTS when ok is false. */
  parentHashes: string[];
  rejected: RejectedParentHash[];
  duplicates: DuplicateParentHash[];
  collectionErrors: ParentHashCollectionError[];
}

/** Normalize and validate one hash. */
export function normalizeHash(hash: string): string {
  if (typeof hash !== "string") {
    throw protocolError(ErrorCode.INVALID_HASH, "hash must be a string");
  }
  const normalized = hash.trim().toLowerCase();
  if (!HASH_PATTERN.test(normalized)) {
    throw protocolError(ErrorCode.INVALID_HASH, "invalid hash: " + hash);
  }
  return normalized;
}

/**
 * Normalize a hash without format validation.
 *
 * This helper still requires a string and does not provide tolerant ingestion.
 */
export function normalizeHashLenient(hash: string): string {
  if (typeof hash !== "string") {
    throw protocolError(ErrorCode.INVALID_HASH, "hash must be a string");
  }
  return hash.trim().toLowerCase();
}

/**
 * Normalize, deduplicate, and sort parent hashes.
 *
 * Omitted input produces an empty array. Supplied collections fail closed when
 * the collection or any entry is invalid.
 */
export function normalizeHashes(hashes?: string[]): string[] {
  if (hashes === undefined) return [];
  if (!Array.isArray(hashes)) {
    throw protocolError(ErrorCode.INVALID_HASH, "parentHashes must be an array");
  }

  const result = [...new Set(hashes.map((hash) => normalizeHash(hash)))].sort();
  if (result.length > MAX_PARENTS) {
    throw protocolError(
      ErrorCode.TOO_MANY_PARENTS,
      "parentHashes exceeds maximum of " + MAX_PARENTS + " after normalization",
    );
  }
  return result;
}

/**
 * Inspect parent hashes from an untrusted import boundary.
 *
 * This helper reports malformed entries and duplicates without changing strict
 * Block creation. Callers must use parentHashes only when ok is true.
 */
export function sanitizeImportedParentHashes(hashes?: unknown): SanitizedParentHashes {
  if (hashes === undefined) {
    return {
      ok: true,
      parentHashes: [],
      rejected: [],
      duplicates: [],
      collectionErrors: [],
    };
  }

  if (!Array.isArray(hashes)) {
    return {
      ok: false,
      parentHashes: [],
      rejected: [{ index: null, value: hashes, reason: "not_array" }],
      duplicates: [],
      collectionErrors: [],
    };
  }

  const accepted = new Set<string>();
  const rejected: RejectedParentHash[] = [];
  const duplicates: DuplicateParentHash[] = [];

  hashes.forEach((hash, index) => {
    if (typeof hash !== "string") {
      rejected.push({ index, value: hash, reason: "invalid_type" });
      return;
    }

    let normalized: string;
    try {
      normalized = normalizeHash(hash);
    } catch {
      rejected.push({ index, value: hash, reason: "invalid_format" });
      return;
    }

    if (accepted.has(normalized)) {
      duplicates.push({ index, hash: normalized });
      return;
    }

    accepted.add(normalized);
  });

  const parentHashes = [...accepted].sort();
  const collectionErrors: ParentHashCollectionError[] =
    parentHashes.length > MAX_PARENTS
      ? [{
          reason: "too_many_parents",
          count: parentHashes.length,
          maximum: MAX_PARENTS,
        }]
      : [];

  return {
    ok: rejected.length === 0 && collectionErrors.length === 0,
    parentHashes,
    rejected,
    duplicates,
    collectionErrors,
  };
}

/** Convert a 0x-prefixed hexadecimal string to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Concatenate byte arrays. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

/** Convert bytes to a hexadecimal string without a 0x prefix. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Compare equal-length hashes without data-dependent early exit. */
export function compareHashesConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
