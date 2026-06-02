/**
 * In-process test vector runner for the TypeScript reference implementation.
 *
 * Used by the HTTP server's /test-vectors/run endpoint and the CLI's
 * test-vectors command. Accepts a lib object (from createLib) and returns
 * a structured result without any I/O side effects beyond reading vector files.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VECTORS_DIR = resolve(new URL("../../protocol/test-vectors", import.meta.url).pathname);

function loadVectors(file) {
  return JSON.parse(readFileSync(resolve(VECTORS_DIR, file), "utf-8"));
}

export function runTestVectors(lib) {
  const results = [];
  let passed = 0;
  let failed = 0;

  function assert(condition, id, message) {
    if (condition) {
      results.push({ id, status: "passed", message });
      passed++;
    } else {
      results.push({ id, status: "failed", message });
      failed++;
    }
  }

  function recordFailure(id, message) {
    results.push({ id, status: "failed", message });
    failed++;
  }

  // ── Canonicalization vectors ──

  try {
    const suite = loadVectors("canonicalization.json");
    for (const v of suite.vectors) {
      // C4 and C10 require language-level constructs JSON cannot represent; tested inline.
      if (v.id === "C4" || v.id === "C10") continue;
      try {
        const actual = lib.canonicalizeProtocolJson(v.input);
        assert(actual === v.expected, v.id, v.description);
      } catch (err) {
        recordFailure(v.id, `${v.description}: ${err.message}`);
      }
    }

    // C4: negative zero (language-specific)
    try {
      const actual = lib.canonicalizeProtocolJson(-0);
      assert(actual === "0", "C4", "negative zero (inline)");
    } catch (err) {
      recordFailure("C4", `negative zero: ${err.message}`);
    }

    // C10: undefined in object (language-specific)
    try {
      const actual = lib.canonicalizeProtocolJson({ a: 1, b: undefined, c: 3 });
      assert(actual === '{"a":1,"c":3}', "C10", "undefined in object excluded (inline)");
    } catch (err) {
      recordFailure("C10", `undefined in object: ${err.message}`);
    }
  } catch (err) {
    recordFailure("canonicalization-suite", `Failed to load suite: ${err.message}`);
  }

  // ── Block identity vectors ──

  try {
    const suite = loadVectors("block-identity.json");
    for (const v of suite.vectors) {
      try {
        switch (v.id) {
          case "B1": {
            const block = lib.createBlock(null, []);
            const ok =
              block.blockHash === lib.deriveBlockHash(null, []) &&
              block.contentHash === lib.deriveContentHash(null) &&
              Array.isArray(block.parentHashes) && block.parentHashes.length === 0 &&
              block.content === null &&
              block.blockHash !== block.contentHash;
            assert(ok, v.id, v.description);
            break;
          }
          case "B2": {
            const block = lib.createBlock("hello", []);
            assert(block.blockHash === lib.deriveBlockHash("hello", []), v.id, v.description);
            break;
          }
          case "B3": {
            const a = lib.createBlock({ z: 1, a: 2 }, []);
            const b = lib.createBlock({ a: 2, z: 1 }, []);
            assert(a.blockHash === b.blockHash, v.id, v.description);
            break;
          }
          case "B4": {
            const p1 = "0x" + "a".repeat(64);
            const p2 = "0x" + "b".repeat(64);
            const a = lib.createBlock("test", [p1, p2]);
            const b = lib.createBlock("test", [p2, p1]);
            assert(
              a.blockHash === b.blockHash &&
              JSON.stringify(a.parentHashes) === JSON.stringify(b.parentHashes),
              v.id, v.description
            );
            break;
          }
          case "B5": {
            const p = "0x" + "a".repeat(64);
            const a = lib.createBlock("test", [p, p, p]);
            const b = lib.createBlock("test", [p]);
            assert(a.blockHash === b.blockHash, v.id, v.description);
            break;
          }
          case "B6": {
            const a = lib.createBlock("alpha", []);
            const b = lib.createBlock("beta", []);
            assert(
              a.blockHash !== b.blockHash && a.contentHash !== b.contentHash,
              v.id, v.description
            );
            break;
          }
          case "B7": {
            const p1 = "0x" + "a".repeat(64);
            const p2 = "0x" + "b".repeat(64);
            const a = lib.createBlock("same", [p1]);
            const b = lib.createBlock("same", [p2]);
            assert(
              a.blockHash !== b.blockHash && a.contentHash === b.contentHash,
              v.id, v.description
            );
            break;
          }
          default:
            results.push({ id: v.id, status: "skipped", message: v.description });
        }
      } catch (err) {
        recordFailure(v.id, `${v.description}: ${err.message}`);
      }
    }
  } catch (err) {
    recordFailure("block-identity-suite", `Failed to load suite: ${err.message}`);
  }

  // ── Attribution trace vectors ──

  try {
    const suite = loadVectors("attribution-trace.json");
    for (const v of suite.vectors) {
      try {
        const graph = new Map(Object.entries(v.graph));
        const trace = lib.traceAttribution(v.root, graph);
        const exp = v.expected;
        const failures = [];

        if (exp.nodeCount !== undefined && trace.nodes.length !== exp.nodeCount)
          failures.push(`nodeCount: expected ${exp.nodeCount}, got ${trace.nodes.length}`);
        if (exp.edgeCount !== undefined && trace.edges.length !== exp.edgeCount)
          failures.push(`edgeCount: expected ${exp.edgeCount}, got ${trace.edges.length}`);
        if (exp.maxDepth !== undefined && trace.maxDepth !== exp.maxDepth)
          failures.push(`maxDepth: expected ${exp.maxDepth}, got ${trace.maxDepth}`);
        if (exp.cycle !== undefined && trace.cycle !== exp.cycle)
          failures.push(`cycle: expected ${exp.cycle}, got ${trace.cycle}`);
        if (exp.leaves !== undefined && JSON.stringify(trace.leaves) !== JSON.stringify(exp.leaves))
          failures.push("leaves mismatch");
        if (exp.leafCount !== undefined && trace.leaves.length !== exp.leafCount)
          failures.push(`leafCount: expected ${exp.leafCount}, got ${trace.leaves.length}`);

        if (exp.pathCounts) {
          for (const [hash, count] of Object.entries(exp.pathCounts)) {
            const node = trace.nodes.find((n) => n.hash === hash);
            if (!node) failures.push(`node ${hash} not found`);
            else if (node.pathCount !== count) failures.push(`pathCount(${hash}): expected ${count}, got ${node.pathCount}`);
          }
        }

        if (exp.nodes) {
          for (const [hash, assertions] of Object.entries(exp.nodes)) {
            const node = trace.nodes.find((n) => n.hash === hash);
            if (!node) { failures.push(`node ${hash} not found`); continue; }
            for (const [key, val] of Object.entries(assertions)) {
              if (node[key] !== val) failures.push(`${key}(${hash}): expected ${val}, got ${node[key]}`);
            }
          }
        }

        if (exp.deterministic) {
          const trace2 = lib.traceAttribution(v.root, graph);
          if (JSON.stringify(trace) !== JSON.stringify(trace2)) failures.push("non-deterministic output");
        }

        if (exp.allLeafPathCount !== undefined) {
          for (const node of trace.nodes.filter((n) => n.hash !== v.root)) {
            if (node.pathCount !== exp.allLeafPathCount)
              failures.push(`allLeafPathCount(${node.hash}): expected ${exp.allLeafPathCount}, got ${node.pathCount}`);
          }
        }

        if (exp.allLeafChildCount !== undefined) {
          for (const node of trace.nodes.filter((n) => n.hash !== v.root)) {
            if (node.childCount !== exp.allLeafChildCount)
              failures.push(`allLeafChildCount(${node.hash}): expected ${exp.allLeafChildCount}, got ${node.childCount}`);
          }
        }

        if (failures.length === 0) assert(true, v.id, v.description);
        else recordFailure(v.id, `${v.description}: ${failures.join("; ")}`);
      } catch (err) {
        recordFailure(v.id, `${v.description}: ${err.message}`);
      }
    }
  } catch (err) {
    recordFailure("attribution-trace-suite", `Failed to load suite: ${err.message}`);
  }

  const total = passed + failed;
  return { passed, failed, total, conformant: failed === 0, results };
}
