import test from "node:test";
import assert from "node:assert/strict";
import { validateLineage, validateGraph, buildGraph, verifyGraph } from "../../dist/block-lineage.js";
import { deriveBlockHash, createBlock } from "../../dist/block.js";

const h = (n) => "0x" + String(n).padStart(64, "0");

// ── validateLineage ──

test("valid lineage with known parents", () => {
  const result = validateLineage(h(1), [h(2), h(3)], [h(2), h(3)]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.duplicates, []);
  assert.deepEqual(result.missing, []);
  assert.equal(result.selfRef, false);
});

test("detects self-reference", () => {
  const result = validateLineage(h(1), [h(1)], [h(1)]);
  assert.equal(result.ok, false);
  assert.equal(result.selfRef, true);
});

test("detects duplicate parents", () => {
  const result = validateLineage(h(1), [h(2), h(2)], [h(2)]);
  assert.equal(result.ok, false);
  assert.ok(result.duplicates.length > 0);
});

test("detects missing parents", () => {
  const result = validateLineage(h(1), [h(2)], [h(3)]);
  assert.equal(result.ok, false);
  assert.ok(result.missing.length > 0);
});

test("no known hashes = no missing check", () => {
  const result = validateLineage(h(1), [h(2)]);
  assert.equal(result.ok, true); // no known set = can't check missing
});

// ── validateGraph ──

test("valid simple chain", () => {
  const graph = new Map([
    [h(1), [h(2)]],
    [h(2), [h(3)]],
    [h(3), []],
  ]);
  const result = validateGraph(graph);
  assert.equal(result.ok, true);
  assert.equal(result.blocks, 3);
  assert.equal(result.edges, 2);
  assert.deepEqual(result.roots, [h(3)]);
});

test("detects cycle in graph", () => {
  const graph = new Map([
    [h(1), [h(2)]],
    [h(2), [h(1)]],
  ]);
  const result = validateGraph(graph);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.cycle));
});

test("diamond DAG is valid", () => {
  const graph = new Map([
    [h(1), [h(2), h(3)]],
    [h(2), [h(4)]],
    [h(3), [h(4)]],
    [h(4), []],
  ]);
  const result = validateGraph(graph);
  assert.equal(result.ok, true);
  assert.equal(result.blocks, 4);
});

test("O(V+E) cycle detection — no per-node DFS", () => {
  // Build a large chain — should not be slow
  const graph = new Map();
  for (let i = 0; i < 1000; i++) {
    graph.set(h(i), i < 999 ? [h(i + 1)] : []);
  }
  const start = Date.now();
  const result = validateGraph(graph);
  const elapsed = Date.now() - start;
  assert.equal(result.ok, true);
  assert.equal(result.blocks, 1000);
  assert.ok(elapsed < 1000, `should complete in <1s, took ${elapsed}ms`);
});

// ── buildGraph ──

test("buildGraph from block array", () => {
  const blocks = [
    { blockHash: h(1), parentHashes: [h(2)] },
    { blockHash: h(2), parentHashes: [] },
  ];
  const graph = buildGraph(blocks);
  assert.equal(graph.size, 2);
  assert.deepEqual(graph.get(h(1)), [h(2)]);
  assert.deepEqual(graph.get(h(2)), []);
});

// ── verifyGraph ──

test("verifyGraph passes for authentic blocks", () => {
  const b1 = createBlock("leaf", []);
  const b2 = createBlock("parent", [b1.blockHash]);
  const result = verifyGraph([b1, b2], deriveBlockHash);
  assert.equal(result.ok, true);
  assert.equal(result.verified, 2);
});

test("verifyGraph fails for tampered block", () => {
  const b1 = createBlock("leaf", []);
  const b2 = createBlock("parent", [b1.blockHash]);
  b2.content = "tampered";
  const result = verifyGraph([b1, b2], deriveBlockHash);
  assert.equal(result.ok, false);
  assert.ok(result.broken.length > 0);
});

test("verifyGraph fails for missing parent", () => {
  const b1 = createBlock("child", ["0x" + "f".repeat(64)]); // parent doesn't exist
  const result = verifyGraph([b1], deriveBlockHash);
  assert.equal(result.ok, false);
  assert.equal(result.verified, 0);
});
