/**
 * canonicalization.ts — Deterministic JSON serialization.
 *
 * Layer 1 of ALX Protocol. Everything else builds on this.
 *
 * Guarantees:
 *   - Same input → same output, always, on any platform
 *   - Object keys: sorted by UTF-16 code units
 *   - Arrays: order-preserving (a sequence, not a set)
 *   - null is canonical; undefined and other language-native values are rejected
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
 * @returns deterministic string representation
 */
export function canonicalizeProtocolJson(value: unknown): string {
  return canonicalizeProtocolJsonInner(value, 0, new WeakSet<object>());
}

/** Recursion state is private so callers cannot bypass the protocol depth limit. */
function canonicalizeProtocolJsonInner(value: unknown, depth: number, seen: WeakSet<object>): string {
  if (depth > MAX_DEPTH) throw protocolError(ErrorCode.CANONICALIZATION_DEPTH, `Canonicalization depth exceeded ${MAX_DEPTH}`);
  if (value === null) return "null";
  if (value === undefined) throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, "undefined is not an ALX value");
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
  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }

  if (typeof value !== "object") {
    throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, `Unsupported type: ${typeof value}`);
  }

  if (seen.has(value)) throw protocolError(ErrorCode.CANONICALIZATION_CYCLIC, "Cyclic reference detected");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, "Sparse arrays are not ALX values");
        }
      }
      return "[" + value.map((item) => canonicalizeProtocolJsonInner(item, depth + 1, seen)).join(",") + "]";
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, "Only plain string-keyed objects are ALX values");
    }
    const obj = value as Record<string, unknown>;
    const ownKeys = Reflect.ownKeys(obj);
    if (ownKeys.some((key) => typeof key !== "string")) {
      throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, "Object keys must be strings");
    }
    if (ownKeys.some((key) => !Object.prototype.propertyIsEnumerable.call(obj, key))) {
      throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, "Object properties must be enumerable data properties");
    }
    const parts: string[] = [];
    for (const key of (ownKeys as string[]).sort()) {
      assertValidUnicode(key);
      const descriptor = Object.getOwnPropertyDescriptor(obj, key);
      if (!descriptor || !("value" in descriptor)) {
        throw protocolError(ErrorCode.CANONICALIZATION_UNSUPPORTED_TYPE, "Object accessors are not ALX values");
      }
      parts.push(JSON.stringify(key) + ":" + canonicalizeProtocolJsonInner(descriptor.value, depth + 1, seen));
    }
    return "{" + parts.join(",") + "}";
  } finally {
    // Reuse across sibling branches is valid; only an active ancestor is cyclic.
    seen.delete(value);
  }
}

function assertValidUnicode(value: string): void {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw protocolError(ErrorCode.CANONICALIZATION_INVALID_UNICODE, "Unpaired UTF-16 high surrogate");
      }
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw protocolError(ErrorCode.CANONICALIZATION_INVALID_UNICODE, "Unpaired UTF-16 low surrogate");
    }
  }
}
