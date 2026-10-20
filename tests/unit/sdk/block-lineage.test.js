import test from "node:test";
import assert from "node:assert/strict";
import {
  addBlockToGraph,
  buildGraph,
  validateGraph,
  validateIncrementalBlock,
  validateLineage,
  verifyGraph,
} from "../../../sdk/dist/block-lineage.js";
import { deriveBlockHash, createBlock } from "../../../sdk/dist/block.js";

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

test("omitted known hashes performs no parent-resolution claim", () => {
  const result = validateLineage(h(1), [h(2)]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});

test("explicit empty known hashes reports every parent missing", () => {
  const result = validateLineage(h(1), [h(2)], []);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [h(2)]);
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

test("Graph preparation rejects malformed hashes, normalized collisions, and invalid modes", () => {
  assert.throws(() => validateGraph(new Map([["bad", []]])), /ALX_INVALID_HASH/);
  assert.throws(() => validateGraph(new Map([
    ["0x" + "A".repeat(64), []],
    ["0x" + "a".repeat(64), []],
  ])), /ALX_DUPLICATE_BLOCK/);
  assert.throws(
    () => validateGraph(new Map([[h(1), []]]), { validationMode: "best-effort" }),
    /ALX_INVALID_GRAPH/,
  );
});

test("Graph issues are ordered by normalized blockHash", () => {
  const result = validateGraph(new Map([
    [h(2), [h(9)]],
    [h(1), [h(9)]],
  ]));
  assert.deepEqual(result.issues.map((issue) => issue.blockHash), [h(1), h(2)]);
});

test("large acyclic Graph validation examines the complete chain", () => {
  const graph = new Map();
  for (let i = 0; i < 1000; i++) {
    graph.set(h(i), i < 999 ? [h(i + 1)] : []);
  }
  const result = validateGraph(graph);
  assert.equal(result.ok, true);
  assert.equal(result.blocks, 1000);
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

test("Graph construction rejects duplicate Block identities and converges after out-of-order arrival", () => {
  const root = createBlock({ type: "root" }, []);
  const child = createBlock({ type: "child" }, [root.blockHash]);
  assert.throws(
    () => buildGraph([root, root]),
    /ALX_DUPLICATE_BLOCK/,
  );

  const incrementalGraph = new Map();
  const beforeParent = validateIncrementalBlock(child, incrementalGraph);
  assert.equal(beforeParent.status, "incomplete");
  addBlockToGraph(root, incrementalGraph);
  const afterParent = validateIncrementalBlock(child, incrementalGraph);
  assert.equal(afterParent.status, "valid");
  addBlockToGraph(child, incrementalGraph);
  assert.throws(() => addBlockToGraph(child, incrementalGraph), /ALX_DUPLICATE_BLOCK/);

  const directGraph = buildGraph([child, root]);
  assert.deepEqual(validateGraph(incrementalGraph), validateGraph(directGraph));
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
