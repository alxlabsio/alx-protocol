/**
 * hash-utils.ts — Shared hash normalization for ALX Protocol.
 *
 * Single source of truth for hash format validation and normalization.
 * Every module that touches hashes imports from here.
 */

import { ErrorCode, protocolError } from "./errors.js";

/** Matches a valid 0x-prefixed, lowercase, 64-char hex hash. */
export const HASH_PATTERN = /^0x[a-f0-9]{64}$/;

/** Maximum number of parent hashes per block. */
export const MAX_PARENTS = 256;

/**
 * Normalize a single hash to lowercase 0x-prefixed 64-char hex.
 * Throws if the result is not a valid hash.
 */
export function normalizeHash(hash: string): string {
  const h = String(hash ?? "").trim().toLowerCase();
  if (!HASH_PATTERN.test(h)) throw protocolError(ErrorCode.INVALID_HASH, `invalid hash: ${hash}`);
  return h;
}

/**
 * Normalize a hash without validation — lowercases and trims.
 * Use only when invalid hashes should be filtered downstream
 * (e.g., inside normalizeHashes which filters after this step).
 */
export function normalizeHashLenient(hash: string): string {
  return String(hash ?? "").trim().toLowerCase();
}

/**
 * Normalize and sort an array of hashes.
 * Silently drops invalid entries (parentHashes may contain partial data).
 * Throws if the normalized result exceeds MAX_PARENTS.
 */
export function normalizeHashes(hashes?: string[]): string[] {
  if (!Array.isArray(hashes)) return [];
  const result = [...new Set(
    hashes
      .map((h) => normalizeHashLenient(h))
      .filter((h) => HASH_PATTERN.test(h))
  )].sort();
  if (result.length > MAX_PARENTS) {
    throw protocolError(ErrorCode.TOO_MANY_PARENTS, `parentHashes exceeds maximum of ${MAX_PARENTS} after normalization`);
  }
  return result;
}

/**
 * Convert a 0x-prefixed hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Concatenate two or more Uint8Arrays into one.
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

/**
 * Convert Uint8Array to hex string (no 0x prefix).
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time hash comparison.
 * Prevents timing side-channels by always comparing all characters.
 */
export function compareHashesConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
