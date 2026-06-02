import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeProtocolJson } from "../../dist/canonicalization.js";

// ── Primitives ──

test("null and undefined both canonicalize to 'null'", () => {
  assert.equal(canonicalizeProtocolJson(null), "null");
  assert.equal(canonicalizeProtocolJson(undefined), "null");
  assert.equal(canonicalizeProtocolJson(null), canonicalizeProtocolJson(undefined));
});

test("booleans", () => {
  assert.equal(canonicalizeProtocolJson(true), "true");
  assert.equal(canonicalizeProtocolJson(false), "false");
});

test("integers", () => {
  assert.equal(canonicalizeProtocolJson(0), "0");
  assert.equal(canonicalizeProtocolJson(1), "1");
  assert.equal(canonicalizeProtocolJson(-1), "-1");
  assert.equal(canonicalizeProtocolJson(42), "42");
});

test("-0 normalizes to 0", () => {
  assert.equal(canonicalizeProtocolJson(-0), "0");
});

test("floats", () => {
  assert.equal(canonicalizeProtocolJson(0.5), "0.5");
  assert.equal(canonicalizeProtocolJson(3.14), "3.14");
});

test("strings are JSON-quoted", () => {
  assert.equal(canonicalizeProtocolJson("hello"), '"hello"');
  assert.equal(canonicalizeProtocolJson(""), '""');
  assert.equal(canonicalizeProtocolJson('a"b'), '"a\\"b"');
});

test("rejects non-finite numbers", () => {
  assert.throws(() => canonicalizeProtocolJson(NaN));
  assert.throws(() => canonicalizeProtocolJson(Infinity));
  assert.throws(() => canonicalizeProtocolJson(-Infinity));
});

test("rejects BigInt", () => {
  assert.throws(() => canonicalizeProtocolJson(BigInt(1)));
});

test("rejects Symbol", () => {
  assert.throws(() => canonicalizeProtocolJson(Symbol("x")));
});

test("rejects unsafe integers", () => {
  assert.throws(() => canonicalizeProtocolJson(Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => canonicalizeProtocolJson(Number.MIN_SAFE_INTEGER - 1));
});

test("MAX_SAFE_INTEGER and MIN_SAFE_INTEGER are accepted", () => {
  assert.equal(canonicalizeProtocolJson(Number.MAX_SAFE_INTEGER), String(Number.MAX_SAFE_INTEGER));
  assert.equal(canonicalizeProtocolJson(Number.MIN_SAFE_INTEGER), String(Number.MIN_SAFE_INTEGER));
});

// ── Arrays ──

test("arrays preserve order", () => {
  assert.equal(canonicalizeProtocolJson(["b", "a"]), '["b","a"]');
  assert.notEqual(canonicalizeProtocolJson(["a", "b"]), canonicalizeProtocolJson(["b", "a"]));
});

test("empty array", () => {
  assert.equal(canonicalizeProtocolJson([]), "[]");
});

// ── Objects ──

test("object keys are sorted", () => {
  assert.equal(canonicalizeProtocolJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalizeProtocolJson({ z: 0, a: 0 }), '{"a":0,"z":0}');
});

test("undefined values in objects are excluded", () => {
  assert.equal(canonicalizeProtocolJson({ a: 1, b: undefined }), '{"a":1}');
});

test("null values in objects are included", () => {
  assert.equal(canonicalizeProtocolJson({ a: null }), '{"a":null}');
});

test("empty object", () => {
  assert.equal(canonicalizeProtocolJson({}), "{}");
});

test("nested objects are recursively sorted", () => {
  const result = canonicalizeProtocolJson({ b: { d: 1, c: 2 }, a: 3 });
  assert.equal(result, '{"a":3,"b":{"c":2,"d":1}}');
});

// ── Determinism ──

test("same input always produces same output", () => {
  const input = { x: [1, { b: 2, a: 1 }], y: null };
  const a = canonicalizeProtocolJson(input);
  const b = canonicalizeProtocolJson(input);
  assert.equal(a, b);
});

test("different key order produces same output", () => {
  const a = canonicalizeProtocolJson({ a: 1, b: 2 });
  const b = canonicalizeProtocolJson({ b: 2, a: 1 });
  assert.equal(a, b);
});
