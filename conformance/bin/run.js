#!/usr/bin/env node

/**
 * ALX Protocol conformance Runner
 *
 * Tests any implementation against the core canonical test vectors.
 *
 * Usage:
 *   node conformance/bin/run.js --self-test
 *   node conformance/bin/run.js --impl "node sdk/conformance-adapter.js"
 *   node conformance/bin/run.js --impl "python reference-implementations/python/conformance_adapter.py"
 *   node conformance/bin/run.js --impl "./my-impl"
 *
 * The --impl command must be a process that reads JSON operations from stdin
 * (one per line) and writes JSON results to stdout (one per line).
 *
 * Operations: canonicalize, deriveBlockHash, createBlock, traceAttribution
 * See conformance/README.md for the full interface contract.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCommand, createExternalImpl, createRunner, green, red, bold, dim } from "../lib/impl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUITES_MANIFEST = JSON.parse(readFileSync(resolve(__dirname, "../../protocol/suites.json"), "utf-8"));
const LIB_DIR = resolve(__dirname, "../../sdk/dist");
const ADAPTER_PATH = resolve(__dirname, "../../sdk/conformance-adapter.js");


function loadVectors(suiteId) {
  const suite = SUITES_MANIFEST.core.suites.find((entry) => entry.id === suiteId);
  if (!suite) throw new Error(`Unknown core suite: ${suiteId}`);
  return JSON.parse(readFileSync(resolve(__dirname, "../..", suite.path), "utf-8"));
}

function suiteHeading(suiteId, title) {
  const suite = SUITES_MANIFEST.core.suites.find((entry) => entry.id === suiteId);
  if (!suite) throw new Error(`Unknown core suite: ${suiteId}`);
  console.log(`\n  ${bold(title)} ${dim(`[${suite.comparison}]`)}`);
}

function getProtocolErrorCode(error) {
  if (typeof error?.code === "string") return error.code;
  return String(error?.message ?? error).match(/\[([A-Z][A-Z0-9_]+)\]/)?.[1];
}

function assertExpectedError(runner, vector, error) {
  const actual = getProtocolErrorCode(error);
  if (actual === vector.expected.errorCode) {
    runner.pass(vector.id, vector.description);
  } else {
    runner.fail(vector.id, vector.description, `errorCode: ${actual ?? "missing"} vs ${vector.expected.errorCode}`);
  }
}

// --- Implementation interface ---

/**
 * Create an implementation interface.
 * For --self-test: calls the TypeScript reference implementation directly.
 * For --impl: spawns a child process and communicates via stdin/stdout.
 */
async function createImpl(mode, implCmd) {
  if (mode === "self-test") {
    return createSelfTestImpl();
  } else {
    return createExternalImpl(implCmd);
  }
}

async function createSelfTestImpl() {
  function lib(name) { return pathToFileURL(resolve(LIB_DIR, name)).href; }
  const { canonicalizeProtocolJson } = await import(lib("canonicalization.js"));
  const { deriveBlockHash, deriveContentHash, createBlock, validateBlock, normalizeHashes } = await import(lib("block.js"));
  const { traceAttribution, verifyTrace } = await import(lib("block-trace.js"));
  const { validateLineage, validateGraph, validateIncrementalBlock, verifyGraph } = await import(lib("block-lineage.js"));

  return {
    async call(operation, input) {
      switch (operation) {
        case "canonicalize": return canonicalizeProtocolJson(input);
        case "canonicalizeGeneratedDepth": {
          let value = input.leaf;
          for (let i = 0; i < input.generatedDepth; i++) value = { nested: value };
          return canonicalizeProtocolJson(value);
        }
        case "deriveBlockHash": return deriveBlockHash(input.content, input.parentHashes ?? []);
        case "deriveContentHash": return deriveContentHash(input.content);
        case "createBlock": return createBlock(input.content, input.parentHashes ?? []);
        case "validateBlock": return validateBlock(input);
        case "normalizeHashes": return normalizeHashes(input);
        case "validateLineage": return validateLineage(
          input.blockHash,
          input.parentHashes ?? [],
          input.knownHashes,
          input.context,
        );
        case "traceAttribution": {
          const graph = new Map(Object.entries(input.graph));
          return traceAttribution(input.rootHash, graph, input.context);
        }
        case "validateGraph": {
          const graph = new Map(Object.entries(input.graph));
          return validateGraph(graph, input.context);
        }
        case "validateIncrementalBlock": {
          const graph = new Map(Object.entries(input.existingGraph));
          return validateIncrementalBlock(input.block, graph, input.context);
        }
        case "verifyTrace": {
          const graph = new Map(Object.entries(input.graph));
          return verifyTrace(input.trace, graph, input.context);
        }
        case "verifyGraph":
          return verifyGraph(input.blocks, deriveBlockHash);
        default: throw new Error(`Unknown operation: ${operation}`);
      }
    },
    async close() {}
  };
}

// --- Test suites ---
// Each suite function receives the implementation handle and the test runner.
// The runner accumulates pass/fail counts without module-level mutable state.

async function runCanonicalizationVectors(impl, isExternal, runner) {
  suiteHeading("canonicalization", "Canonicalization");
  const data = loadVectors("canonicalization");

  for (const v of data.vectors) {
    if (isExternal && (v.id === "C4" || v.id === "C10")) {
      runner.skip(v.id, v.description + " requires an in-language test");
      continue;
    }
    try {
      const input = v.id === "C4"
        ? -0
        : v.id === "C10"
          ? { a: 1, b: undefined, c: 3 }
          : v.input;
      const result = await impl.call("canonicalize", input);
      if (result === v.expected) runner.pass(v.id, v.description);
      else runner.fail(v.id, v.description, `expected: ${JSON.stringify(v.expected)}, got: ${JSON.stringify(result)}`);
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

async function runBlockIdentityVectors(impl, runner) {
  suiteHeading("block-identity", "Block Identity");
  const data = loadVectors("block-identity");

  for (const v of data.vectors) {
    try {
      const checks = [];

      const checkExpectedBlock = async (label, input, block, expected) => {
        if (block.blockHash !== expected.blockHash) checks.push(`${label}.blockHash: ${block.blockHash} vs ${expected.blockHash}`);
        if (block.contentHash !== expected.contentHash) checks.push(`${label}.contentHash: ${block.contentHash} vs ${expected.contentHash}`);
        if (JSON.stringify(block.parentHashes) !== JSON.stringify(expected.parentHashes)) {
          checks.push(`${label}.parentHashes: ${JSON.stringify(block.parentHashes)} vs ${JSON.stringify(expected.parentHashes)}`);
        }
        const envelope = await impl.call("canonicalize", {
          content: input.content ?? null,
          parentHashes: block.parentHashes,
        });
        const envelopeHex = Buffer.from(envelope, "utf8").toString("hex");
        if (envelopeHex !== expected.canonicalEnvelopeHex) {
          checks.push(`${label}.canonicalEnvelopeHex: ${envelopeHex} vs ${expected.canonicalEnvelopeHex}`);
        }
      };

      if (v.input) {
        const block = await impl.call("createBlock", { content: v.input.content, parentHashes: v.input.parentHashes ?? [] });
        const block2 = await impl.call("createBlock", { content: v.input.content, parentHashes: v.input.parentHashes ?? [] });
        await checkExpectedBlock("block", v.input, block, v.expected);
        if (block.blockHash !== block2.blockHash) checks.push("non-deterministic");
        const derivedBlockHash = await impl.call("deriveBlockHash", v.input);
        const derivedContentHash = await impl.call("deriveContentHash", { content: v.input.content });
        if (derivedBlockHash !== v.expected.blockHash) checks.push(`derived blockHash: ${derivedBlockHash} vs ${v.expected.blockHash}`);
        if (derivedContentHash !== v.expected.contentHash) checks.push(`derived contentHash: ${derivedContentHash} vs ${v.expected.contentHash}`);
        if (JSON.stringify(block.content) !== JSON.stringify(v.input.content)) checks.push("content was not preserved");
        if (v.assertions?.some((assertion) => assertion.includes("blockHash != contentHash")) && block.blockHash === block.contentHash) {
          checks.push("blockHash should differ from contentHash");
        }
      } else if (v.input_a && v.input_b) {
        const a = await impl.call("createBlock", { content: v.input_a.content, parentHashes: v.input_a.parentHashes ?? [] });
        const b = await impl.call("createBlock", { content: v.input_b.content, parentHashes: v.input_b.parentHashes ?? [] });
        await checkExpectedBlock("a", v.input_a, a, v.expected_a);
        await checkExpectedBlock("b", v.input_b, b, v.expected_b);
        for (const assertion of v.assertions ?? []) {
          if (assertion.includes("!=") && assertion.includes("blockHash")) {
            if (a.blockHash === b.blockHash) checks.push("blockHash should differ");
          } else if (assertion.includes("==") && assertion.includes("blockHash")) {
            if (a.blockHash !== b.blockHash) checks.push(`blockHash should be equal: ${a.blockHash} vs ${b.blockHash}`);
          } else if (assertion.includes("!=") && assertion.includes("contentHash")) {
            if (a.contentHash === b.contentHash) checks.push("contentHash should differ");
          } else if (assertion.includes("==") && assertion.includes("contentHash")) {
            if (a.contentHash !== b.contentHash) checks.push(`contentHash should be equal: ${a.contentHash} vs ${b.contentHash}`);
          } else if (assertion.includes("==") && assertion.includes("parentHashes")) {
            if (JSON.stringify(a.parentHashes) !== JSON.stringify(b.parentHashes)) checks.push("parentHashes should be equal");
          }
        }
      }

      if (checks.length === 0) runner.pass(v.id, v.description);
      else runner.fail(v.id, v.description, checks.join("; "));
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

async function runCanonicalizationDepthVectors(impl, runner) {
  suiteHeading("canonicalization-depth", "Canonicalization Depth");
  const data = loadVectors("canonicalization-depth");
  for (const v of data.vectors) {
    try {
      await impl.call("canonicalizeGeneratedDepth", v.input);
      if (v.expected.ok) runner.pass(v.id, v.description);
      else runner.fail(v.id, v.description, "expected error");
    } catch (e) {
      if (v.expected.ok) runner.fail(v.id, v.description, `ERROR: ${e.message}`);
      else assertExpectedError(runner, v, e);
    }
  }
}

function generatedParents(count) {
  return Array.from({ length: count }, (_, i) => "0x" + i.toString(16).padStart(64, "0"));
}

async function runParentLimitVectors(impl, runner) {
  suiteHeading("parent-limits", "Parent Limits");
  const data = loadVectors("parent-limits");
  for (const v of data.vectors) {
    const parentHashes = generatedParents(v.input.generatedParentCount);
    try {
      const block = await impl.call("createBlock", { content: v.input.content, parentHashes });
      if (!v.expected.ok) {
        runner.fail(v.id, v.description, "expected error");
      } else if (block.parentHashes.length !== v.expected.normalizedParentCount) {
        runner.fail(v.id, v.description, `normalizedParentCount: ${block.parentHashes.length} vs ${v.expected.normalizedParentCount}`);
      } else {
        runner.pass(v.id, v.description);
      }
    } catch (e) {
      if (v.expected.ok) runner.fail(v.id, v.description, `ERROR: ${e.message}`);
      else assertExpectedError(runner, v, e);
    }
  }
}

async function runAttributionTraceVectors(impl, runner) {
  suiteHeading("attribution-trace", "Attribution Trace");
  const data = loadVectors("attribution-trace");

  for (const v of data.vectors) {
    try {
      const trace = await impl.call("traceAttribution", { rootHash: v.root, graph: v.graph, context: v.context });
      const checks = [];
      const exp = v.expected;

      if (trace.root !== v.root) checks.push(`root: ${trace.root} vs ${v.root}`);
      if (exp.nodeCount !== undefined && trace.nodes.length !== exp.nodeCount) checks.push(`nodeCount: ${trace.nodes.length} vs ${exp.nodeCount}`);
      if (exp.edgeCount !== undefined && trace.edges.length !== exp.edgeCount) checks.push(`edgeCount: ${trace.edges.length} vs ${exp.edgeCount}`);
      if (exp.leafCount !== undefined && trace.leaves.length !== exp.leafCount) checks.push(`leafCount: ${trace.leaves.length} vs ${exp.leafCount}`);
      if (exp.maxDepth !== undefined && trace.maxDepth !== exp.maxDepth) checks.push(`maxDepth: ${trace.maxDepth} vs ${exp.maxDepth}`);
      if (exp.cycle !== undefined && trace.cycle !== exp.cycle) checks.push(`cycle: ${trace.cycle} vs ${exp.cycle}`);
      if (exp.validationMode !== undefined && trace.validationMode !== exp.validationMode) checks.push(`validationMode: ${trace.validationMode} vs ${exp.validationMode}`);
      if (exp.complete !== undefined && trace.complete !== exp.complete) checks.push(`complete: ${trace.complete} vs ${exp.complete}`);
      if (exp.leaves) {
        const el = JSON.stringify([...exp.leaves].sort());
        const al = JSON.stringify([...trace.leaves].sort());
        if (el !== al) checks.push(`leaves: ${al} vs ${el}`);
      }
      if (exp.pathCounts) {
        for (const [hash, count] of Object.entries(exp.pathCounts)) {
          const node = trace.nodes.find(n => n.hash === hash);
          if (!node) checks.push(`missing node ${hash.slice(0, 10)}...`);
          else if (node.pathCount !== count) checks.push(`${hash.slice(0, 10)}... pathCount: ${node.pathCount} vs ${count}`);
        }
      }
      if (exp.nodes) {
        for (const [hash, assertions] of Object.entries(exp.nodes)) {
          const node = trace.nodes.find((candidate) => candidate.hash === hash);
          if (!node) {
            checks.push(`missing node ${hash.slice(0, 10)}...`);
            continue;
          }
          for (const [key, value] of Object.entries(assertions)) {
            if (node[key] !== value) checks.push(`${hash.slice(0, 10)}... ${key}: ${node[key]} vs ${value}`);
          }
        }
      }
      if (exp.allLeafPathCount !== undefined) {
        for (const node of trace.nodes.filter((candidate) => candidate.hash !== v.root)) {
          if (node.pathCount !== exp.allLeafPathCount) checks.push(`${node.hash.slice(0, 10)}... pathCount: ${node.pathCount} vs ${exp.allLeafPathCount}`);
        }
      }
      if (exp.allLeafChildCount !== undefined) {
        for (const node of trace.nodes.filter((candidate) => candidate.hash !== v.root)) {
          if (node.childCount !== exp.allLeafChildCount) checks.push(`${node.hash.slice(0, 10)}... childCount: ${node.childCount} vs ${exp.allLeafChildCount}`);
        }
      }
      if (exp.missingParents && JSON.stringify(trace.missingParents ?? []) !== JSON.stringify(exp.missingParents)) {
        checks.push(`missingParents: ${JSON.stringify(trace.missingParents ?? [])} vs ${JSON.stringify(exp.missingParents)}`);
      }
      if (exp.externalParents && JSON.stringify(trace.externalParents ?? []) !== JSON.stringify(exp.externalParents)) {
        checks.push(`externalParents: ${JSON.stringify(trace.externalParents ?? [])} vs ${JSON.stringify(exp.externalParents)}`);
      }
      // Determinism check
      const trace2 = await impl.call("traceAttribution", { rootHash: v.root, graph: v.graph, context: v.context });
      if (JSON.stringify(trace) !== JSON.stringify(trace2)) checks.push("non-deterministic");

      if (checks.length === 0) runner.pass(v.id, v.description);
      else runner.fail(v.id, v.description, checks.join("; "));
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

async function runLineageBoundaryVectors(impl, runner) {
  suiteHeading("lineage-boundaries", "Lineage Boundaries");
  const data = loadVectors("lineage-boundaries");

  for (const v of data.vectors) {
    try {
      const result = await impl.call(v.operation, v.input);
      const checks = [];
      const exp = v.expected;
      if (result.ok !== exp.ok) checks.push(`ok: ${result.ok} vs ${exp.ok}`);
      if (exp.issueCount !== undefined && result.issues?.length !== exp.issueCount) checks.push(`issueCount: ${result.issues?.length ?? 0} vs ${exp.issueCount}`);
      if (exp.missing) {
        const actualMissing = exp.issueCount !== undefined ? (result.issues?.[0]?.missing ?? []) : (result.missing ?? []);
        if (JSON.stringify(actualMissing) !== JSON.stringify(exp.missing)) checks.push(`missing: ${JSON.stringify(actualMissing)} vs ${JSON.stringify(exp.missing)}`);
      }
      if (exp.external) {
        const actualExternal = exp.issueCount !== undefined && exp.issueCount > 0
          ? (result.issues?.[0]?.external ?? [])
          : (result.externalParents ?? result.external ?? []);
        if (JSON.stringify(actualExternal) !== JSON.stringify(exp.external)) checks.push(`external: ${JSON.stringify(actualExternal)} vs ${JSON.stringify(exp.external)}`);
      }
      if (exp.cycle !== undefined && result.cycle !== exp.cycle) checks.push(`cycle: ${result.cycle} vs ${exp.cycle}`);
      if (checks.length === 0) runner.pass(v.id, v.description);
      else runner.fail(v.id, v.description, checks.join("; "));
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

async function runSemanticValidityVectors(impl, runner) {
  suiteHeading("semantic-validity", "Semantic Validity");
  const data = loadVectors("semantic-validity");

  for (const v of data.vectors) {
    try {
      const result = await impl.call(v.operation, v.input);
      const checks = [];
      const exp = v.expected;
      if (result.ok !== exp.ok) checks.push(`ok: ${result.ok} vs ${exp.ok}`);
      if (exp.issueCount !== undefined && result.issues?.length !== exp.issueCount) checks.push(`issueCount: ${result.issues?.length ?? 0} vs ${exp.issueCount}`);
      if (exp.missing) {
        const actualMissing = result.issues?.[0]?.missing ?? result.missing ?? [];
        if (JSON.stringify(actualMissing) !== JSON.stringify(exp.missing)) checks.push(`missing: ${JSON.stringify(actualMissing)} vs ${JSON.stringify(exp.missing)}`);
      }
      if (exp.parentsCanonical !== undefined && result.parentsCanonical !== exp.parentsCanonical) checks.push(`parentsCanonical: ${result.parentsCanonical} vs ${exp.parentsCanonical}`);
      if (exp.selfRef !== undefined && result.selfRef !== exp.selfRef) checks.push(`selfRef: ${result.selfRef} vs ${exp.selfRef}`);
      if (checks.length === 0) runner.pass(v.id, v.description);
      else runner.fail(v.id, v.description, checks.join("; "));
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

async function runSemanticIntegrityVectors(impl, runner) {
  suiteHeading("semantic-integrity", "Semantic Integrity");
  const data = loadVectors("semantic-integrity");
  for (const v of data.vectors) {
    try {
      const result = await impl.call(v.operation, v.input);
      const checks = [];
      if (result.ok !== v.expected.ok) checks.push(`ok: ${result.ok} vs ${v.expected.ok}`);
      if (v.expected.validationMode !== undefined && result.validationMode !== v.expected.validationMode) checks.push(`validationMode: ${result.validationMode} vs ${v.expected.validationMode}`);
      if (v.expected.complete !== undefined && result.complete !== v.expected.complete) checks.push(`complete: ${result.complete} vs ${v.expected.complete}`);
      if (v.expected.missingParents && JSON.stringify(result.missingParents ?? []) !== JSON.stringify(v.expected.missingParents)) checks.push(`missingParents: ${JSON.stringify(result.missingParents ?? [])} vs ${JSON.stringify(v.expected.missingParents)}`);
      if (v.expected.externalParents && JSON.stringify(result.externalParents ?? []) !== JSON.stringify(v.expected.externalParents)) checks.push(`externalParents: ${JSON.stringify(result.externalParents ?? [])} vs ${JSON.stringify(v.expected.externalParents)}`);
      for (const issue of v.expected.issues ?? []) {
        if (!(result.issues ?? []).includes(issue)) checks.push(`missing issue ${issue}`);
      }
      if (v.expected.brokenReason && !(result.broken ?? []).some((item) => item.reason === v.expected.brokenReason)) {
        checks.push(`missing broken reason ${v.expected.brokenReason}`);
      }
      checks.length === 0 ? runner.pass(v.id, v.description) : runner.fail(v.id, v.description, checks.join("; "));
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

// --- Negative vectors (rejection tests) ---

async function runCanonicalizationNegativeVectors(impl, isExternal, runner) {
  suiteHeading("canonicalization-negative", "Canonicalization (rejection)");
  const data = loadVectors("canonicalization-negative");
  const vectorById = new Map(data.vectors.map((vector) => [vector.id, vector]));

  if (isExternal) {
    // Language-native and cyclic values cannot be sent via JSON.
    // External implementations MUST test these in-language.
    // We test only JSON-representable rejection cases.
    runner.skip("CN1", "NaN rejection requires an in-language test");
    runner.skip("CN2", "Infinity rejection requires an in-language test");
    runner.skip("CN3", "-Infinity rejection requires an in-language test");
    runner.skip("CN7", "cyclic-reference rejection requires an in-language test");
    runner.skip("CN8", "BigInt rejection requires an applicable in-language test");
    runner.skip("CN9", "Symbol rejection requires an applicable in-language test");
  } else {
    const nonJsonNegatives = [
      { ...vectorById.get("CN1"), input: NaN },
      { ...vectorById.get("CN2"), input: Infinity },
      { ...vectorById.get("CN3"), input: -Infinity },
    ];
    for (const v of nonJsonNegatives) {
      try { await impl.call("canonicalize", v.input); runner.fail(v.id, v.description, "expected error"); }
      catch (e) { assertExpectedError(runner, v, e); }
    }
  }

  const jsonNegatives = [vectorById.get("CN4"), vectorById.get("CN5")];
  for (const v of jsonNegatives) {
    try { await impl.call("canonicalize", v.input); runner.fail(v.id, v.description, "expected error"); }
    catch (e) { assertExpectedError(runner, v, e); }
  }

  // Depth overflow — build 129-level nested object
  let deep = { value: "leaf" };
  for (let i = 0; i < 129; i++) deep = { nested: deep };
  const depthVector = vectorById.get("CN6");
  try { await impl.call("canonicalize", deep); runner.fail(depthVector.id, depthVector.description, "expected error"); }
  catch (e) { assertExpectedError(runner, depthVector, e); }

  if (!isExternal) {
    const cyclic = {};
    cyclic.self = cyclic;
    const nativeNegatives = [
      { ...vectorById.get("CN7"), input: cyclic },
      { ...vectorById.get("CN8"), input: 1n },
      { ...vectorById.get("CN9"), input: Symbol("x") },
    ];
    for (const v of nativeNegatives) {
      try { await impl.call("canonicalize", v.input); runner.fail(v.id, v.description, "expected error"); }
      catch (e) { assertExpectedError(runner, v, e); }
    }
  }
}

async function runParentNormalizationVectors(impl, runner) {
  suiteHeading("parent-normalization", "Parent Normalization");
  const data = loadVectors("parent-normalization");

  for (const vector of data.vectors) {
    const input = vector.inputMode === "omitted" ? undefined : vector.input;
    try {
      const normalized = await impl.call("normalizeHashes", input);
      if (!vector.expected.ok) {
        runner.fail(vector.id, vector.description, "expected error " + vector.expected.errorCode);
      } else if (JSON.stringify(normalized) !== JSON.stringify(vector.expected.normalized)) {
        runner.fail(
          vector.id,
          vector.description,
          "normalized: " + JSON.stringify(normalized) + " vs " + JSON.stringify(vector.expected.normalized),
        );
      } else {
        runner.pass(vector.id, vector.description);
      }
    } catch (error) {
      if (vector.expected.ok) {
        runner.fail(vector.id, vector.description, "ERROR: " + error.message);
      } else {
        assertExpectedError(runner, vector, error);
      }
    }
  }
}

async function runLineageNegativeVectors(impl, runner) {
  suiteHeading("lineage-negative", "Lineage (rejection)");
  const data = loadVectors("lineage-negative");

  for (const v of data.vectors) {
    try {
      if (v.input && v.expected.selfRef !== undefined) {
        const result = await impl.call("validateLineage", v.input);
        const checks = [];
        if (result.ok !== v.expected.ok) checks.push(`ok: ${result.ok} vs ${v.expected.ok}`);
        if (result.selfRef !== v.expected.selfRef) checks.push(`selfRef: ${result.selfRef} vs ${v.expected.selfRef}`);
        checks.length === 0 ? runner.pass(v.id, v.description) : runner.fail(v.id, v.description, checks.join("; "));
      } else if (v.graph && v.expected.hasCycle) {
        const trace = await impl.call("traceAttribution", {
          rootHash: Object.keys(v.graph)[0],
          graph: v.graph,
        });
        if (trace.cycle === true) runner.pass(v.id, v.description);
        else runner.fail(v.id, v.description, "expected cycle=true");
      } else if (v.expected.duplicates) {
        const result = await impl.call("validateLineage", v.input);
        if (JSON.stringify(result.duplicates) === JSON.stringify(v.expected.duplicates)) runner.pass(v.id, v.description);
        else runner.fail(v.id, v.description, `duplicates: ${JSON.stringify(result.duplicates)} vs ${JSON.stringify(v.expected.duplicates)}`);
      } else if (v.expected.errorCode) {
        try {
          await impl.call("normalizeHashes", v.input.parentHashes);
          runner.fail(v.id, v.description, "expected error " + v.expected.errorCode);
        } catch (error) {
          assertExpectedError(runner, v, error);
        }
      } else if (v.expected.normalized) {
        const normalized = await impl.call("normalizeHashes", v.input.parentHashes);
        if (JSON.stringify(normalized) === JSON.stringify(v.expected.normalized)) runner.pass(v.id, v.description);
        else runner.fail(v.id, v.description, `normalized: ${JSON.stringify(normalized)} vs ${JSON.stringify(v.expected.normalized)}`);
      } else {
        runner.fail(v.id, v.description, "unsupported lineage vector shape");
      }
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }
}

// --- Main ---

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
${bold("ALX Protocol conformance Runner")}

Usage:
  node conformance/bin/run.js --self-test
  node conformance/bin/run.js --impl <command>

Options:
  --self-test     Test the TypeScript reference implementation directly
  --impl <cmd>    Test an external implementation via stdin/stdout

The --impl command must be a process that reads JSON operations
from stdin (one per line) and writes JSON results to stdout.

See conformance/README.md for the interface contract.

Examples:
  node conformance/bin/run.js --self-test
  node conformance/bin/run.js --impl "node sdk/conformance-adapter.js"
  node conformance/bin/run.js --impl "python reference-implementations/python/conformance_adapter.py"
  node conformance/bin/run.js --impl "./my-go-impl"
`);
  process.exit(0);
}

// Determine mode
let mode, implCmd;
const implIdx = args.indexOf("--impl");

if (args.includes("--self-test")) {
  mode = "self-test";
} else if (implIdx !== -1 && args[implIdx + 1]) {
  mode = "external";
  implCmd = args[implIdx + 1];
} else {
  console.error("Use --self-test or --impl <command>. Run --help for usage.");
  process.exit(2);
}

console.log(`\n${bold("ALX conformance Suite")} ${dim(`protocol v1`)}\n`);
if (mode === "self-test") {
  console.log(`  Mode: ${bold("self-test")} (TypeScript reference implementation)`);
} else {
  console.log(`  Mode: ${bold("external")} (${implCmd})`);
}

const impl = await createImpl(mode, implCmd);
const testRunner = createRunner();
const isExternal = mode === "external";

const suiteRunners = {
  canonicalization: (i, r) => runCanonicalizationVectors(i, isExternal, r),
  "canonicalization-negative": (i, r) => runCanonicalizationNegativeVectors(i, isExternal, r),
  "canonicalization-depth": (i, r) => runCanonicalizationDepthVectors(i, r),
  "block-identity": (i, r) => runBlockIdentityVectors(i, r),
  "parent-normalization": (i, r) => runParentNormalizationVectors(i, r),
  "parent-limits": (i, r) => runParentLimitVectors(i, r),
  "attribution-trace": (i, r) => runAttributionTraceVectors(i, r),
  "lineage-negative": (i, r) => runLineageNegativeVectors(i, r),
  "lineage-boundaries": (i, r) => runLineageBoundaryVectors(i, r),
  "semantic-validity": (i, r) => runSemanticValidityVectors(i, r),
  "semantic-integrity": (i, r) => runSemanticIntegrityVectors(i, r),
};

for (const suite of SUITES_MANIFEST.core.suites) {
  const suiteRunner = suiteRunners[suite.id];
  if (!suiteRunner) throw new Error(`No core conformance runner registered for suite ${suite.id}`);
  const before = testRunner.getState();
  await suiteRunner(impl, testRunner);
  const after = testRunner.getState();
  testRunner.pushSuite({
    id: suite.id,
    comparison: suite.comparison,
    passed: after.passed - before.passed,
    failed: after.failed - before.failed,
    skipped: after.skipped - before.skipped,
  });
}

await impl.close();

const { passed, failed, skipped, total, suiteResults } = testRunner.getState();

console.log(`\n  ${"\u2500".repeat(44)}`);
console.log(`  ${bold("Total:")} ${passed}/${total} passed` + (failed > 0 ? `, ${red(`${failed} failed`)}` : "") + (skipped > 0 ? `, ${skipped} native-only checks skipped` : ""));
const exactSuiteCount = suiteResults.filter((s) => s.comparison === "exact").length;
const semanticSuiteCount = suiteResults.filter((s) => s.comparison === "semantic").length;
console.log(`  ${bold("Coverage:")} ${exactSuiteCount} exact-output suite(s), ${semanticSuiteCount} semantic suite(s)`);
console.log();

if (failed === 0 && skipped === 0) {
  console.log(`  ${green("\u2713")} ${green("CONFORMANT")} with ALX Protocol v1`);
} else if (failed === 0) {
  console.log(`  ${green("\u2713")} ${green("PORTABLE CHECKS PASSED")} — run native suites for ${skipped} skipped case(s)`);
} else {
  console.log(`  ${red("\u2717")} ${red("NOT CONFORMANT")} — ${failed} vector(s) failed`);
}
console.log();
process.exit(failed > 0 ? 1 : 0);
