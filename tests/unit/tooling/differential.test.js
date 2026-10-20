import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProtocolErrorCode,
  normativeCapture,
  pairwiseMismatches,
  reverseFiniteSource,
  reverseRecord,
  seededShuffle,
  shuffleFiniteSource,
} from "../../../conformance/lib/differential.js";

test("differential comparison treats protocol error identifiers as normative", () => {
  const captures = {
    typescript: { kind: "error", errorCode: "ALX_INVALID_GRAPH", message: "TypeScript detail" },
    python: { kind: "error", errorCode: "ALX_INVALID_GRAPH", message: "Python detail" },
    rust: { kind: "error", errorCode: "ALX_INVALID_GRAPH", message: "Rust detail" },
  };

  assert.deepEqual(pairwiseMismatches(captures), []);
  assert.deepEqual(normativeCapture(captures.rust), {
    kind: "error",
    errorCode: "ALX_INVALID_GRAPH",
  });
  assert.equal(extractProtocolErrorCode(new Error("[ALX_GRAPH_CYCLE] cycle")), "ALX_GRAPH_CYCLE");
});

test("differential comparison reports every divergent implementation pair", () => {
  const mismatches = pairwiseMismatches({
    typescript: { kind: "output", value: { status: "valid" } },
    python: { kind: "output", value: { status: "invalid" } },
    rust: { kind: "output", value: { status: "valid" } },
  });

  assert.deepEqual(mismatches.map(({ implementations }) => implementations), [
    ["typescript", "python"],
    ["python", "rust"],
  ]);
});

test("order transformations are immutable and deterministic", () => {
  const graph = { first: ["parent"], second: [] };
  const request = { source: { kind: "finite", blocks: [{ blockHash: "first" }, { blockHash: "second" }] } };

  assert.deepEqual(Object.keys(reverseRecord(graph)), ["second", "first"]);
  assert.deepEqual(
    reverseFiniteSource(request).source.blocks.map(({ blockHash }) => blockHash),
    ["second", "first"],
  );
  assert.deepEqual(seededShuffle([1, 2, 3, 4, 5]), seededShuffle([1, 2, 3, 4, 5]));
  assert.deepEqual(
    shuffleFiniteSource(request).source.blocks,
    seededShuffle(request.source.blocks),
  );
  assert.equal(request.source.blocks[0].blockHash, "first");
});
