/**
 * canonicalization.ts — Deterministic JSON serialization.
 *
 * Layer 1 of ALX Protocol. Everything else builds on this.
 *
 * Guarantees:
 *   - Same input → same output, always, on any platform
 *   - Object keys: sorted lexicographically, undefined values excluded
 *   - Arrays: order-preserving (a sequence, not a set)
 *   - null and undefined: both canonicalize to "null" (canonical empty)
 *   - Numbers: -0 → 0, safe integer range enforced, non-finite rejected
 *   - BigInt, Symbol: rejected (not representable in JSON)
 */

import { ErrorCode, protocolError } from "./errors.js";

export const CANONICALIZATION_ALGORITHM = "recursive-json-sort-v1" as const;

/** Maximum nesting depth to prevent stack overflow from adversarial input. */
const MAX_DEPTH = 128;

/**
 * Canonical JSON serialization.
 *
 * @param value — any JSON-compatible value
 * @param _depth — internal recursion counter (do not set manually)
 * @param _seen — internal cycle detector (do not set manually)
 * @returns deterministic string representation
 */
export function canonicalizeProtocolJson(value: unknown, _depth = 0, _seen?: WeakSet<object>): string {
  if (_depth > MAX_DEPTH) throw protocolError(ErrorCode.CANONICALIZATION_DEPTH, `Canonicalization depth exceeded ${MAX_DEPTH}`);
  if (value === undefined || value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") throw protocolError(ErrorCode.CANONICALIZATION_BIGINT, "BigInt not allowed: use a string or safe integer");
  if (typeof value === "symbol") throw protocolError(ErrorCode.CANONICALIZATION_SYMBOL, "Symbol not allowed");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw protocolError(ErrorCode.CANONICALIZATION_NON_FINITE, `Non-finite number not allowed: ${value}`);
    if (Object.is(value, -0)) return "0";
    if (Number.isInteger(value)) {
      if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
        throw protocolError(ErrorCode.CANONICALIZATION_UNSAFE_INTEGER, `Integer out of safe range: ${value}. Use a string.`);
      }
      return String(value);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);

  // Arrays and objects: detect cyclic references
  const seen = _seen ?? new WeakSet<object>();
  if (seen.has(value as object)) throw protocolError(ErrorCode.CANONICALIZATION_CYCLIC, "Cyclic reference detected");
  seen.add(value as object);

  if (Array.isArray(value)) return "[" + value.map((v) => canonicalizeProtocolJson(v, _depth + 1, seen)).join(",") + "]";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalizeProtocolJson(obj[k], _depth + 1, seen)).join(",") + "}";
  }
  throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, `Unsupported type: ${typeof value}`);
}
