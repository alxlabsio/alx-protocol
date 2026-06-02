import test from "node:test";
import assert from "node:assert/strict";
import { deriveBlockHash, deriveContentHash, createBlock, validateBlock, normalizeHash, normalizeHashes } from "../../dist/block.js";

// ── deriveBlockHash ──

test("same content + same parents = same hash", () => {
  const a = deriveBlockHash("hello", []);
  const b = deriveBlockHash("hello", []);
  assert.equal(a, b);
});

test("different content = different hash", () => {
  const a = deriveBlockHash("hello", []);
  const b = deriveBlockHash("world", []);
  assert.notEqual(a, b);
});

test("different parents = different hash", () => {
  const p1 = "0x" + "a".repeat(64);
  const p2 = "0x" + "b".repeat(64);
  const a = deriveBlockHash("hello", [p1]);
  const b = deriveBlockHash("hello", [p2]);
  assert.notEqual(a, b);
});

test("hash is 0x-prefixed 64-char hex", () => {
  const h = deriveBlockHash("test", []);
  assert.match(h, /^0x[a-f0-9]{64}$/);
});

test("null and undefined content produce same hash", () => {
  const a = deriveBlockHash(null, []);
  const b = deriveBlockHash(undefined, []);
  assert.equal(a, b);
});

test("parent order does not matter (sorted internally)", () => {
  const p1 = "0x" + "a".repeat(64);
  const p2 = "0x" + "b".repeat(64);
  const a = deriveBlockHash("test", [p1, p2]);
  const b = deriveBlockHash("test", [p2, p1]);
  assert.equal(a, b);
});

test("duplicate parents are deduplicated", () => {
  const p = "0x" + "a".repeat(64);
  const a = deriveBlockHash("test", [p, p]);
  const b = deriveBlockHash("test", [p]);
  assert.equal(a, b);
});

// ── deriveContentHash ──

test("contentHash differs from blockHash (no parents)", () => {
  // They differ because blockHash includes parentHashes in the hash input
  const blockHash = deriveBlockHash({ x: 1 }, []);
  const contentHash = deriveContentHash({ x: 1 });
  // They CAN be equal if parentHashes is [] since canonical({content: X, parentHashes: []})
  // is different from canonical(X). So they should differ.
  assert.notEqual(blockHash, contentHash);
});

// ── createBlock ──

test("createBlock returns blockHash, contentHash, parentHashes, content", () => {
  const block = createBlock("hello world", []);
  assert.equal(typeof block.blockHash, "string");
  assert.equal(typeof block.contentHash, "string");
  assert.deepEqual(block.parentHashes, []);
  assert.equal(block.content, "hello world");
});

test("createBlock with null content", () => {
  const block = createBlock(null, []);
  assert.equal(block.content, null);
  assert.equal(typeof block.blockHash, "string");
});

test("createBlock blockHash matches deriveBlockHash", () => {
  const content = { key: "value" };
  const parents = ["0x" + "a".repeat(64)];
  const block = createBlock(content, parents);
  assert.equal(block.blockHash, deriveBlockHash(content, parents));
});

// ── validateBlock ──

test("validateBlock passes for valid block", () => {
  const block = createBlock("test", []);
  const result = validateBlock(block);
  assert.equal(result.ok, true);
});

test("validateBlock fails for tampered content", () => {
  const block = createBlock("test", []);
  block.content = "tampered";
  const result = validateBlock(block);
  assert.equal(result.ok, false);
  assert.notEqual(result.expected, result.actual);
});

test("validateBlock fails for tampered parentHashes", () => {
  const p = "0x" + "a".repeat(64);
  const block = createBlock("test", [p]);
  block.parentHashes = [];
  const result = validateBlock(block);
  assert.equal(result.ok, false);
});

// ── normalizeHash ──

test("normalizeHash lowercases", () => {
  const h = "0x" + "A".repeat(64);
  assert.equal(normalizeHash(h), "0x" + "a".repeat(64));
});

test("normalizeHash rejects invalid hash", () => {
  assert.throws(() => normalizeHash("not-a-hash"));
  assert.throws(() => normalizeHash("0xshort"));
  assert.throws(() => normalizeHash(""));
});

// ── normalizeHashes ──

test("normalizeHashes deduplicates and sorts", () => {
  const a = "0x" + "b".repeat(64);
  const b = "0x" + "a".repeat(64);
  const result = normalizeHashes([a, b, a]);
  assert.deepEqual(result, [b, a]); // sorted: a < b
});

test("normalizeHashes drops invalid entries", () => {
  const valid = "0x" + "a".repeat(64);
  const result = normalizeHashes([valid, "invalid", "", null]);
  assert.deepEqual(result, [valid]);
});

test("normalizeHashes returns empty for non-array", () => {
  assert.deepEqual(normalizeHashes(null), []);
  assert.deepEqual(normalizeHashes(undefined), []);
});
