/**
 * ALX Protocol Conformance Test Vectors
 *
 * These vectors define the canonical expected outputs for given inputs.
 * Any conforming implementation in any language MUST produce identical results.
 *
 * If a test in this file fails, the protocol has been broken.
 *
 * Canonical test vector data files live in protocol/test-vectors/*.json.
 * This runner loads those files AND includes inline tests for language-specific
 * edge cases (e.g., -0, undefined) that JSON cannot represent.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeProtocolJson } from "../../dist/canonicalization.js";
import { deriveBlockHash, deriveContentHash, createBlock, validateBlock } from "../../dist/block.js";
import { traceAttribution } from "../../dist/block-trace.js";
import { validateGraph, validateIncrementalBlock } from "../../dist/block-lineage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectorsDir = resolve(__dirname, "../../../../protocol/test-vectors");

function loadVectors(file) {
  return JSON.parse(readFileSync(resolve(vectorsDir, file), "utf-8"));
}

// ════════════════════════════════════════════════════════════════════════════
// DATA-DRIVEN VECTORS FROM protocol/test-vectors/
// ════════════════════════════════════════════════════════════════════════════

test("protocol/test-vectors/canonicalization.json", async (t) => {
  const suite = loadVectors("canonicalization.json");
  for (const v of suite.vectors) {
    // Skip C4 (negative zero) and C10 (undefined) — tested inline below
    if (v.id === "C4" || v.id === "C10") continue;
    await t.test(`VECTOR ${v.id}: ${v.description}`, () => {
      assert.equal(canonicalizeProtocolJson(v.input), v.expected);
    });
  }
});

test("protocol/test-vectors/attribution-trace.json", async (t) => {
  const suite = loadVectors("attribution-trace.json");
  for (const v of suite.vectors) {
    await t.test(`VECTOR ${v.id}: ${v.description}`, () => {
      const graph = new Map(Object.entries(v.graph));
      const trace = traceAttribution(v.root, graph);
      const exp = v.expected;

      if (exp.nodeCount !== undefined) assert.equal(trace.nodes.length, exp.nodeCount);
      if (exp.edgeCount !== undefined) assert.equal(trace.edges.length, exp.edgeCount);
      if (exp.maxDepth !== undefined) assert.equal(trace.maxDepth, exp.maxDepth);
      if (exp.cycle !== undefined) assert.equal(trace.cycle, exp.cycle);
      if (exp.leaves !== undefined) assert.deepEqual(trace.leaves, exp.leaves);
      if (exp.leafCount !== undefined) assert.equal(trace.leaves.length, exp.leafCount);

      if (exp.pathCounts) {
        for (const [hash, count] of Object.entries(exp.pathCounts)) {
          const node = trace.nodes.find((n) => n.hash === hash);
          assert.equal(node.pathCount, count, `pathCount for ${hash}`);
        }
      }

      if (exp.nodes) {
        for (const [hash, assertions] of Object.entries(exp.nodes)) {
          const node = trace.nodes.find((n) => n.hash === hash);
          assert.ok(node, `node ${hash} should exist`);
          for (const [key, val] of Object.entries(assertions)) {
            assert.equal(node[key], val, `${key} for ${hash}`);
          }
        }
      }

      if (exp.deterministic) {
        const trace2 = traceAttribution(v.root, graph);
        assert.deepEqual(trace, trace2);
      }

      if (exp.allLeafPathCount !== undefined) {
        const root = v.root;
        for (const node of trace.nodes.filter((n) => n.hash !== root)) {
          assert.equal(node.pathCount, exp.allLeafPathCount);
        }
      }
      if (exp.allLeafChildCount !== undefined) {
        const root = v.root;
        for (const node of trace.nodes.filter((n) => n.hash !== root)) {
          assert.equal(node.childCount, exp.allLeafChildCount);
        }
      }
    });
  }
});

test("protocol/test-vectors/parent-limits.json", async (t) => {
  const suite = loadVectors("parent-limits.json");
  const generatedParents = (count) => Array.from({ length: count }, (_, i) => "0x" + i.toString(16).padStart(64, "0"));
  for (const v of suite.vectors) {
    await t.test(`VECTOR ${v.id}: ${v.description}`, () => {
      const parents = generatedParents(v.input.generatedParentCount);
      if (v.expected.ok) {
        const block = createBlock(v.input.content, parents);
        assert.equal(block.parentHashes.length, v.expected.normalizedParentCount);
      } else {
        assert.throws(() => createBlock(v.input.content, parents));
      }
    });
  }
});

test("protocol/test-vectors/canonicalization-depth.json", async (t) => {
  const suite = loadVectors("canonicalization-depth.json");
  for (const v of suite.vectors) {
    await t.test(`VECTOR ${v.id}: ${v.description}`, () => {
      let value = v.input.leaf;
      for (let i = 0; i < v.input.generatedDepth; i++) value = { nested: value };
      if (v.expected.ok) {
        assert.doesNotThrow(() => canonicalizeProtocolJson(value));
      } else {
        assert.throws(() => canonicalizeProtocolJson(value));
      }
    });
  }
});

test("protocol/test-vectors/lineage-boundaries.json", async (t) => {
  const suite = loadVectors("lineage-boundaries.json");
  for (const v of suite.vectors) {
    await t.test(`VECTOR ${v.id}: ${v.description}`, () => {
      let result;
      if (v.operation === "validateGraph") {
        result = validateGraph(new Map(Object.entries(v.input.graph)), v.input.context);
      } else if (v.operation === "validateIncrementalBlock") {
        result = validateIncrementalBlock(
          v.input.block,
          new Map(Object.entries(v.input.existingGraph)),
          v.input.context,
        );
      } else {
        throw new Error(`unknown operation ${v.operation}`);
      }
      assert.equal(result.ok, v.expected.ok);
      if (v.expected.issueCount !== undefined) assert.equal(result.issues.length, v.expected.issueCount);
      if (v.expected.missing !== undefined) {
        const missing = v.expected.issueCount > 0 ? result.issues[0].missing : result.missing;
        assert.deepEqual(missing, v.expected.missing);
      }
      if (v.expected.external !== undefined) {
        const external = v.expected.issueCount > 0 ? result.issues[0].external : result.externalParents;
        assert.deepEqual(external, v.expected.external);
      }
      if (v.expected.cycle !== undefined) assert.equal(result.cycle, v.expected.cycle);
    });
  }
});

test("protocol/test-vectors/semantic-validity.json", async (t) => {
  const suite = loadVectors("semantic-validity.json");
  for (const v of suite.vectors) {
    await t.test(`VECTOR ${v.id}: ${v.description}`, () => {
      let result;
      if (v.operation === "validateBlock") {
        result = validateBlock(v.input);
      } else if (v.operation === "validateGraph") {
        result = validateGraph(new Map(Object.entries(v.input.graph)));
      } else {
        throw new Error(`unknown operation ${v.operation}`);
      }
      assert.equal(result.ok, v.expected.ok);
      if (v.expected.issueCount !== undefined) assert.equal(result.issues.length, v.expected.issueCount);
      if (v.expected.missing !== undefined) assert.deepEqual(result.issues[0].missing, v.expected.missing);
      if (v.expected.parentsCanonical !== undefined) assert.equal(result.parentsCanonical, v.expected.parentsCanonical);
      if (v.expected.selfRef !== undefined) assert.equal(result.selfRef, v.expected.selfRef);
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CANONICALIZATION VECTORS
// ════════════════════════════════════════════════════════════════════════════

test("VECTOR C1: null", () => {
  assert.equal(canonicalizeProtocolJson(null), "null");
});

test("VECTOR C2: empty string", () => {
  assert.equal(canonicalizeProtocolJson(""), '""');
});

test("VECTOR C3: integer zero", () => {
  assert.equal(canonicalizeProtocolJson(0), "0");
});

test("VECTOR C4: negative zero", () => {
  assert.equal(canonicalizeProtocolJson(-0), "0");
});

test("VECTOR C5: empty object", () => {
  assert.equal(canonicalizeProtocolJson({}), "{}");
});

test("VECTOR C6: empty array", () => {
  assert.equal(canonicalizeProtocolJson([]), "[]");
});

test("VECTOR C7: sorted keys", () => {
  assert.equal(
    canonicalizeProtocolJson({ z: 1, a: 2, m: 3 }),
    '{"a":2,"m":3,"z":1}',
  );
});

test("VECTOR C8: nested object with sorted keys", () => {
  assert.equal(
    canonicalizeProtocolJson({ b: { d: 1, c: 2 }, a: 3 }),
    '{"a":3,"b":{"c":2,"d":1}}',
  );
});

test("VECTOR C9: array order preserved", () => {
  assert.equal(
    canonicalizeProtocolJson([3, 1, 2]),
    "[3,1,2]",
  );
});

test("VECTOR C10: undefined in object excluded", () => {
  assert.equal(
    canonicalizeProtocolJson({ a: 1, b: undefined, c: 3 }),
    '{"a":1,"c":3}',
  );
});

test("VECTOR C11: null in object included", () => {
  assert.equal(
    canonicalizeProtocolJson({ a: null }),
    '{"a":null}',
  );
});

test("VECTOR C12: boolean values", () => {
  assert.equal(
    canonicalizeProtocolJson({ f: false, t: true }),
    '{"f":false,"t":true}',
  );
});

test("VECTOR C13: string with special characters", () => {
  assert.equal(
    canonicalizeProtocolJson('hello "world"'),
    '"hello \\"world\\""',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK IDENTITY VECTORS
// ════════════════════════════════════════════════════════════════════════════

test("VECTOR B1: empty block (null content, no parents)", () => {
  const block = createBlock(null, []);
  // Canonical input: {"content":null,"parentHashes":[]}
  assert.equal(block.blockHash, deriveBlockHash(null, []));
  assert.equal(block.contentHash, deriveContentHash(null));
  assert.deepEqual(block.parentHashes, []);
  assert.equal(block.content, null);
  // blockHash and contentHash should differ (different hash inputs)
  assert.notEqual(block.blockHash, block.contentHash);
});

test("VECTOR B2: simple string content", () => {
  const block = createBlock("hello", []);
  const expected = deriveBlockHash("hello", []);
  assert.equal(block.blockHash, expected);
});

test("VECTOR B3: object content with keys", () => {
  // Key order in input should not matter
  const a = createBlock({ z: 1, a: 2 }, []);
  const b = createBlock({ a: 2, z: 1 }, []);
  assert.equal(a.blockHash, b.blockHash);
});

test("VECTOR B4: parent order does not matter", () => {
  const p1 = "0x" + "a".repeat(64);
  const p2 = "0x" + "b".repeat(64);
  const a = createBlock("test", [p1, p2]);
  const b = createBlock("test", [p2, p1]);
  assert.equal(a.blockHash, b.blockHash);
  assert.deepEqual(a.parentHashes, b.parentHashes);
});

test("VECTOR B5: duplicate parents are deduplicated", () => {
  const p = "0x" + "a".repeat(64);
  const a = createBlock("test", [p, p, p]);
  const b = createBlock("test", [p]);
  assert.equal(a.blockHash, b.blockHash);
});

test("VECTOR B6: different content = different blockHash", () => {
  const a = createBlock("alpha", []);
  const b = createBlock("beta", []);
  assert.notEqual(a.blockHash, b.blockHash);
  assert.notEqual(a.contentHash, b.contentHash);
});

test("VECTOR B7: same content, different parents = different blockHash, same contentHash", () => {
  const p1 = "0x" + "a".repeat(64);
  const p2 = "0x" + "b".repeat(64);
  const a = createBlock("same", [p1]);
  const b = createBlock("same", [p2]);
  assert.notEqual(a.blockHash, b.blockHash);
  assert.equal(a.contentHash, b.contentHash);
});

// ════════════════════════════════════════════════════════════════════════════
// ATTRIBUTION TRACE VECTORS
// ════════════════════════════════════════════════════════════════════════════

const h = (n) => "0x" + String(n).padStart(64, "0");

test("VECTOR T1: linear chain A→B→C", () => {
  const graph = new Map([
    [h(1), [h(2)]],
    [h(2), [h(3)]],
    [h(3), []],
  ]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.root, h(1));
  assert.equal(trace.nodes.length, 3);
  assert.equal(trace.edges.length, 2);
  assert.deepEqual(trace.leaves, [h(3)]);
  assert.equal(trace.maxDepth, 2);
  assert.equal(trace.cycle, false);

  // Path counts: each node reachable via exactly 1 path
  for (const node of trace.nodes) {
    assert.equal(node.pathCount, 1);
  }
});

test("VECTOR T2: diamond A→[B,C], B→D, C→D", () => {
  const graph = new Map([
    [h(1), [h(2), h(3)]],
    [h(2), [h(4)]],
    [h(3), [h(4)]],
    [h(4), []],
  ]);
  const trace = traceAttribution(h(1), graph);

  assert.equal(trace.nodes.length, 4);
  assert.deepEqual(trace.leaves, [h(4)]);

  const d = trace.nodes.find((n) => n.hash === h(4));
  assert.equal(d.pathCount, 2, "D reachable via A→B→D and A→C→D");
  assert.equal(d.minDepth, 2);
  assert.equal(d.maxDepth, 2);
  assert.equal(d.childCount, 2);

  const b = trace.nodes.find((n) => n.hash === h(2));
  assert.equal(b.pathCount, 1);
  assert.equal(b.childCount, 1);
});

test("VECTOR T3: asymmetric diamond (different path lengths to same leaf)", () => {
  // A→B→D (depth 2), A→C→E→D (depth 3)
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
  assert.equal(d.minDepth, 2, "shortest path: A→B→D");
  assert.equal(d.maxDepth, 3, "longest path: A→C→E→D");
});

test("VECTOR T4: single node (root is leaf)", () => {
  const graph = new Map([[h(1), []]]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.nodes.length, 1);
  assert.deepEqual(trace.leaves, [h(1)]);
  assert.equal(trace.edges.length, 0);
  assert.equal(trace.maxDepth, 0);
  assert.equal(trace.nodes[0].pathCount, 1);
});

test("VECTOR T5: wide fan-out (1 root, 10 leaves)", () => {
  const parents = Array.from({ length: 10 }, (_, i) => h(10 + i));
  const graph = new Map([
    [h(1), parents],
    ...parents.map((p) => [p, []]),
  ]);
  const trace = traceAttribution(h(1), graph);
  assert.equal(trace.nodes.length, 11);
  assert.equal(trace.leaves.length, 10);
  assert.equal(trace.edges.length, 10);
  for (const leaf of trace.nodes.filter((n) => n.hash !== h(1))) {
    assert.equal(leaf.pathCount, 1);
    assert.equal(leaf.childCount, 1);
  }
});

test("VECTOR T6: determinism — same input produces identical output", () => {
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
