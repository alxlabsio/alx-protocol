import test from "node:test";
import assert from "node:assert/strict";
import { traceAttribution } from "../../dist/block-trace.js";

const h = (n) => "0x" + String(n).padStart(64, "0");

// ── Basic chain ──

test("simple chain: A → B → C (leaf)", () => {
  const graph = new Map([
    [h(1), [h(2)]],
    [h(2), [h(3)]],
    [h(3), []],
  ]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.root, h(1));
  assert.equal(trace.nodes.length, 3);
  assert.deepEqual(trace.leaves, [h(3)]);
  assert.equal(trace.maxDepth, 2);
  assert.equal(trace.cycle, false);

  const root = trace.nodes.find((n) => n.hash === h(1));
  assert.equal(root.minDepth, 0);
  assert.equal(root.pathCount, 1);

  const leaf = trace.nodes.find((n) => n.hash === h(3));
  assert.equal(leaf.minDepth, 2);
  assert.equal(leaf.pathCount, 1);
});

// ── Diamond DAG (critical test for pathCount) ──

test("diamond DAG: A → [B, C], B → D, C → D", () => {
  const graph = new Map([
    [h(1), [h(2), h(3)]],
    [h(2), [h(4)]],
    [h(3), [h(4)]],
    [h(4), []],
  ]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.nodes.length, 4);
  assert.deepEqual(trace.leaves, [h(4)]);

  // D is reachable via two paths: A→B→D and A→C→D
  const d = trace.nodes.find((n) => n.hash === h(4));
  assert.equal(d.pathCount, 2, "D should have pathCount=2 (two paths from root)");
  assert.equal(d.minDepth, 2);
  assert.equal(d.maxDepth, 2);
  assert.equal(d.childCount, 2); // B and C both reference D
});

// ── Deep diamond ──

test("deep diamond: paths of different lengths", () => {
  // A → B → D, A → C → E → D
  const graph = new Map([
    [h(1), [h(2), h(3)]],
    [h(2), [h(4)]],
    [h(3), [h(5)]],
    [h(5), [h(4)]],
    [h(4), []],
  ]);
  const trace = traceAttribution(h(1), graph);
  const d = trace.nodes.find((n) => n.hash === h(4));
  assert.equal(d.pathCount, 2);
  assert.equal(d.minDepth, 2); // A→B→D
  assert.equal(d.maxDepth, 3); // A→C→E→D
});

// ── Wide fan-out ──

test("wide fan-out: root → 5 leaves", () => {
  const parents = [h(10), h(11), h(12), h(13), h(14)];
  const graph = new Map([
    [h(1), parents],
    ...parents.map((p) => [p, []]),
  ]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.nodes.length, 6);
  assert.equal(trace.leaves.length, 5);
  assert.equal(trace.edges.length, 5);
});

// ── Single node (leaf root) ──

test("single node with no parents", () => {
  const graph = new Map([[h(1), []]]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.nodes.length, 1);
  assert.deepEqual(trace.leaves, [h(1)]);
  assert.equal(trace.maxDepth, 0);
  assert.equal(trace.edges.length, 0);
});

// ── Root not in graph ──

test("root with no entry in graph is a leaf", () => {
  const graph = new Map();
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.nodes.length, 1);
  assert.deepEqual(trace.leaves, [h(1)]);
});

// ── Cycle detection ──

test("detects cycle", () => {
  const graph = new Map([
    [h(1), [h(2)]],
    [h(2), [h(1)]],
  ]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.cycle, true);
});

// ── Determinism ──

test("same root + same graph = same trace", () => {
  const graph = new Map([
    [h(1), [h(2), h(3)]],
    [h(2), [h(4)]],
    [h(3), [h(4)]],
    [h(4), []],
  ]);
  const a = traceAttribution(h(1), graph);
  const b = traceAttribution(h(1), graph);
  assert.deepEqual(a, b);
});

// ── Error handling ──

test("throws on missing rootHash", () => {
  assert.throws(() => traceAttribution("", new Map()));
});

test("throws on non-Map graph", () => {
  assert.throws(() => traceAttribution(h(1), {}));
});
