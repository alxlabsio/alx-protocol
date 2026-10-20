#!/usr/bin/env node

import { isDeepStrictEqual } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  captureImplementationCall,
  normativeCapture,
  pairwiseMismatches,
  reverseFiniteSource,
  reverseRecord,
  shuffleFiniteSource,
} from "../lib/differential.js";
import { createExternalImpl } from "../lib/impl.js";
import { loadCoreManifest } from "../lib/manifest.js";
import { REPO_ROOT } from "../lib/repo-root.js";

const DEFAULT_REPORT_PATH = "artifacts/cross-language/differential-report.json";
const IMPLEMENTATION_COMMANDS = {
  typescript: "node sdk/conformance-adapter.js",
  python: "python reference-implementations/python/conformance_adapter.py",
  rust: "reference-implementations/rust/target/release/conformance_adapter",
};

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function graphForTraceVector(vector) {
  if (vector.graph) return vector.graph;
  if (vector.input?.graph) return vector.input.graph;
  const depth = vector.generatedFibonacciDepth;
  const hash = (index) => `0x${index.toString(16).padStart(64, "0")}`;
  return Object.fromEntries(Array.from({ length: depth }, (_, offset) => {
    const index = offset + 1;
    const parents = [];
    if (index + 1 <= depth) parents.push(hash(index + 1));
    if (index + 2 <= depth) parents.push(hash(index + 2));
    return [hash(index), parents];
  }));
}

function traceInput(vector) {
  if (vector.input?.graph) return clone(vector.input);
  const graph = graphForTraceVector(vector);
  return {
    rootHash: vector.root ?? Object.keys(graph)[0],
    graph,
    ...(vector.context === undefined ? {} : { context: clone(vector.context) }),
  };
}

function blockCases(suite) {
  return suite.document.vectors.flatMap((vector) => vector.input
    ? [{ id: `${vector.id}.input`, input: vector.input, expected: vector.expected }]
    : [
        { id: `${vector.id}.input_a`, input: vector.input_a, expected: vector.expected_a },
        { id: `${vector.id}.input_b`, input: vector.input_b, expected: vector.expected_b },
      ]);
}

function expectedMismatches(captures, expected, projection) {
  const mismatches = [];
  for (const [implementation, capture] of Object.entries(captures)) {
    if (expected?.errorCode) {
      if (capture.kind !== "error" || capture.errorCode !== expected.errorCode) {
        mismatches.push({ implementation, expected: { kind: "error", errorCode: expected.errorCode }, actual: normativeCapture(capture) });
      }
      continue;
    }
    if (capture.kind !== "output") {
      mismatches.push({ implementation, expected: { kind: "output", value: expected }, actual: normativeCapture(capture) });
      continue;
    }
    const actual = projection ? projection(capture.value) : capture.value;
    if (!isDeepStrictEqual(actual, expected)) mismatches.push({ implementation, expected, actual });
  }
  return mismatches;
}

function captureForReport(capture) {
  return capture.kind === "output"
    ? capture
    : { kind: "error", errorCode: capture.errorCode, message: capture.message };
}

function projectCaptures(captures, projection) {
  if (!projection) return captures;
  return Object.fromEntries(Object.entries(captures).map(([name, capture]) => [
    name,
    capture.kind === "output" ? { kind: "output", value: projection(capture.value) } : capture,
  ]));
}

async function main() {
  const reportPath = resolve(REPO_ROOT, argumentValue("--report", DEFAULT_REPORT_PATH));
  const loaded = loadCoreManifest();
  const suites = new Map(loaded.suites.map((suite) => [suite.descriptor.id, suite]));
  const report = {
    reportFormat: "1",
    protocol: loaded.manifest.protocol,
    protocolVersion: loaded.manifest.protocolVersion,
    vectorFormat: loaded.manifest.vectorFormat,
    implementations: Object.keys(IMPLEMENTATION_COMMANDS),
    suites: loaded.suites.map(({ descriptor }) => ({
      id: descriptor.id,
      operation: descriptor.operation,
      comparison: descriptor.comparison,
      vectorCount: descriptor.vectorCount,
      sha256: descriptor.sha256,
    })),
    cases: [],
    summary: { passed: 0, failed: 0, total: 0 },
  };
  const implementations = Object.fromEntries(Object.entries(IMPLEMENTATION_COMMANDS).map(([name, command]) => [
    name,
    createExternalImpl(command, { callTimeoutMs: 15_000, maxOutputBytes: 16 * 1024 * 1024 }),
  ]));

  const writeReport = () => {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  };

  async function executeCase(testCase) {
    const captures = Object.fromEntries(await Promise.all(
      Object.entries(implementations).map(async ([name, implementation]) => [
        name,
        await captureImplementationCall(implementation, testCase.operation, testCase.input),
      ]),
    ));
    const pairwise = pairwiseMismatches(projectCaptures(captures, testCase.pairwiseProjection));
    const expected = testCase.expected === undefined
      ? []
      : expectedMismatches(captures, testCase.expected, testCase.expectedProjection);
    const determinism = [];
    if (testCase.baseline) {
      for (const name of Object.keys(implementations)) {
        if (!isDeepStrictEqual(normativeCapture(captures[name]), normativeCapture(testCase.baseline[name]))) {
          determinism.push({
            implementation: name,
            baseline: normativeCapture(testCase.baseline[name]),
            actual: normativeCapture(captures[name]),
          });
        }
      }
    }
    const passed = pairwise.length === 0 && expected.length === 0 && determinism.length === 0;
    report.cases.push({
      id: testCase.id,
      category: testCase.category,
      operation: testCase.operation,
      transformation: testCase.transformation ?? "base",
      status: passed ? "passed" : "failed",
      captures: Object.fromEntries(Object.entries(captures).map(([name, capture]) => [name, captureForReport(capture)])),
      mismatches: { pairwise, expected, determinism },
    });
    report.summary.total += 1;
    report.summary[passed ? "passed" : "failed"] += 1;
    console.log(`${passed ? "✓" : "✗"} ${testCase.id}`);
    return captures;
  }

  try {
    const startup = await executeCase({
      id: "startup.canonicalize-null",
      category: "adapter",
      operation: "canonicalize",
      input: null,
      expected: "null",
    });
    if (Object.values(startup).some(({ kind }) => kind === "error")) {
      throw new Error("All three maintained implementation adapters are mandatory");
    }

    const canonicalization = suites.get("canonicalization");
    for (const vector of canonicalization.document.vectors) {
      if (vector.id === "C4") continue;
      await executeCase({
        id: `canonicalization.${vector.id}`,
        category: "canonicalization",
        operation: "canonicalize",
        input: vector.input,
        expected: vector.expected,
      });
    }

    const identity = suites.get("block-identity");
    const blockProjection = ({ blockHash, contentHash, parentHashes }) => ({ blockHash, contentHash, parentHashes });
    for (const blockCase of blockCases(identity)) {
      const base = await executeCase({
        id: `block.${blockCase.id}`,
        category: "block",
        operation: "createBlock",
        input: blockCase.input,
        expected: {
          blockHash: blockCase.expected.blockHash,
          contentHash: blockCase.expected.contentHash,
          parentHashes: blockCase.expected.parentHashes,
        },
        expectedProjection: blockProjection,
      });
      await executeCase({
        id: `block.${blockCase.id}.repeat`,
        category: "block",
        operation: "createBlock",
        input: blockCase.input,
        baseline: base,
        transformation: "repeat",
      });
    }

    const graphVectors = loaded.suites.flatMap(({ document }) => document.vectors)
      .filter(({ operation }) => operation === "validateGraph");
    for (const vector of graphVectors) {
      const base = await executeCase({
        id: `graph.${vector.id}`,
        category: "graph",
        operation: "validateGraph",
        input: vector.input,
        expected: vector.expected,
      });
      if (!vector.expected.errorCode) {
        await executeCase({
          id: `graph.${vector.id}.repeat`,
          category: "graph",
          operation: "validateGraph",
          input: vector.input,
          expected: vector.expected,
          baseline: base,
          transformation: "repeat",
        });
        await executeCase({
          id: `graph.${vector.id}.reversed-source`,
          category: "graph",
          operation: "validateGraph",
          input: reverseFiniteSource(vector.input),
          expected: vector.expected,
          baseline: base,
          transformation: "reversed-source",
        });
        await executeCase({
          id: `graph.${vector.id}.shuffled-source`,
          category: "graph",
          operation: "validateGraph",
          input: shuffleFiniteSource(vector.input),
          expected: vector.expected,
          baseline: base,
          transformation: "seeded-shuffled-source",
        });
      }
    }

    const traceVectors = [
      ...suites.get("attribution-trace").document.vectors,
      ...suites.get("lineage-negative").document.vectors.filter(({ operation }) => operation === "traceAttribution"),
      ...suites.get("semantic-integrity").document.vectors.filter(({ operation }) => operation === "traceAttribution"),
    ];
    for (const vector of traceVectors) {
      const input = traceInput(vector);
      const expected = vector.expected.errorCode
        ? vector.expected
        : (vector.expected.hasCycle ? { errorCode: "ALX_GRAPH_CYCLE" } : undefined);
      const base = await executeCase({
        id: `trace.${vector.id}`,
        category: "trace",
        operation: "traceAttribution",
        input,
        expected,
      });
      if (!expected?.errorCode) {
        await executeCase({
          id: `trace.${vector.id}.repeat`,
          category: "trace",
          operation: "traceAttribution",
          input,
          baseline: base,
          transformation: "repeat",
        });
        await executeCase({
          id: `trace.${vector.id}.reversed-graph`,
          category: "trace",
          operation: "traceAttribution",
          input: { ...input, graph: reverseRecord(input.graph) },
          baseline: base,
          transformation: "reversed-graph",
        });
      }
    }

    const graphBoundaryBase = clone(
      suites.get("graph-validation-outcomes").document.vectors.find(({ id }) => id === "GVO1"),
    );
    const atLimitContext = { ...graphBoundaryBase.input.context, extensions: ["😀".repeat(128)] };
    await executeCase({
      id: "boundary.extensions-128-code-points",
      category: "boundary",
      operation: "validateGraph",
      input: { ...graphBoundaryBase.input, context: atLimitContext },
      expected: { ...graphBoundaryBase.expected, context: atLimitContext },
    });
    await executeCase({
      id: "boundary.extensions-129-code-points",
      category: "boundary",
      operation: "validateGraph",
      input: {
        ...graphBoundaryBase.input,
        context: { ...graphBoundaryBase.input.context, extensions: ["😀".repeat(129)] },
      },
      expected: { errorCode: "ALX_INVALID_GRAPH" },
    });
  } catch (error) {
    report.fatalError = String(error?.message ?? error);
    report.summary.failed += 1;
    console.error(`Differential verification aborted: ${report.fatalError}`);
  } finally {
    await Promise.allSettled(Object.values(implementations).map((implementation) => implementation.close()));
    writeReport();
  }

  console.log(`\nDifferential verification: ${report.summary.passed}/${report.summary.total} cases passed.`);
  console.log(`Report: ${reportPath}`);
  if (report.summary.failed > 0 || report.fatalError) process.exitCode = 1;
}

await main();
