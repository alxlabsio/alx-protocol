/**
 * block-lineage.ts — DAG integrity for block references.
 *
 * Blocks reference parents. This forms a directed acyclic graph.
 * The protocol validates that the graph is structurally sound:
 *
 *   - No cycles (a block cannot be its own ancestor)
 *   - No self-references (a block cannot reference itself)
 *   - No duplicate parents (each reference is unique)
 *   - Optionally: no orphans (all parents exist in the known set)
 *
 * The protocol does not interpret why blocks reference each other.
 * It only verifies that the references form a valid DAG.
 */

import { normalizeHash, normalizeHashLenient } from "./hash-utils.js";
import { ErrorCode, protocolError } from "./errors.js";
import { validateGraphVerification } from "./graph-validation.js";
import type { GraphValidationStatus, GraphVerification } from "./graph-validation.js";

/** Result of single-block lineage validation. */
export interface LineageResult {
  checked: true;
  status: GraphValidationStatus;
  ok: boolean;
  blockHash: string;
  parents: string[];
  duplicates: string[];
  missing: string[];
  external: string[];
  selfRef: boolean;
  cycle: boolean;
}

/** Result of full graph validation. */
export interface GraphResult {
  ok: boolean;
  blocks: number;
  edges: number;
  roots: string[];
  mode: "closed-world" | "open-world";
  externalParents: string[];
  issues: LineageResult[];
}

export interface GraphValidationContext {
  validationMode?: "closed-world" | "open-world";
  externalParents?: Array<{ hash: string }>;
}

/** Result of graph verification (authenticity check). */
export interface VerifyResult {
  ok: boolean;
  verified: number;
  broken: Array<{ blockHash: string; reason: string; expected?: string; parentHash?: string }>;
}

/**
 * Validate a single block's lineage within an optional known set.
 */
export function validateLineage(
  blockHash: string,
  parentHashes: string[],
  knownHashes?: Set<string> | string[],
  context?: GraphValidationContext,
): LineageResult {
  const hash = normalizeHash(blockHash);
  if (!Array.isArray(parentHashes)) {
    throw protocolError(ErrorCode.INVALID_HASH, "parentHashes must be an array");
  }
  const known = knownHashes === undefined
    ? undefined
    : new Set([...knownHashes].map(normalizeHash));

  const { unique, duplicates, selfRef, missing, external } = classifyParents(hash, parentHashes, known, context);

  // Without the full graph, the only cycle detectable is a self-reference.
  // Full graph cycles require validateGraph.
  const cycle = selfRef;

  const status = lineageStatus(duplicates, missing, selfRef || cycle);

  return {
    checked: true,
    status,
    ok: duplicates.length === 0 && missing.length === 0 && !selfRef,
    blockHash: hash,
    parents: unique,
    duplicates,
    missing,
    external,
    selfRef,
    cycle,
  };
}

/** Validate an entire adjacency Graph for structural integrity. */
export function validateGraphStructure(
  graph: Map<string, string[]> | Array<[string, string[]]>,
  context?: GraphValidationContext,
): GraphResult {
  const g = prepareGraph(graph);
  const mode = validationMode(context);
  const declaredExternal = normalizedExternalParents(context);
  const allHashes = new Set(g.keys());
  const issues: LineageResult[] = [];
  const externalParents = new Set<string>();
  let edges = 0;
  const roots: string[] = [];

  // Single-pass cycle detection for entire graph: O(V+E)
  const cycleNodes = detectAllCycles(g);

  for (const [hash, parents] of g) {
    edges += parents.length;
    if (parents.length === 0) roots.push(hash);

    const classified = classifyPreparedParents(hash, parents, allHashes, mode, declaredExternal);
    const result: LineageResult = {
      checked: true,
      status: lineageStatus(
        classified.duplicates,
        classified.missing,
        classified.selfRef || cycleNodes.has(hash),
      ),
      ok: classified.duplicates.length === 0 && classified.missing.length === 0 && !classified.selfRef,
      blockHash: hash,
      parents: classified.unique,
      duplicates: classified.duplicates,
      missing: classified.missing,
      external: classified.external,
      selfRef: classified.selfRef,
      cycle: classified.selfRef,
    };
    for (const parent of result.external) externalParents.add(parent);

    if (cycleNodes.has(hash)) {
      result.cycle = true;
      result.ok = false;
    }

    if (!result.ok) issues.push(result);
  }

  return {
    ok: issues.length === 0,
    blocks: g.size,
    edges,
    roots: roots.sort(),
    mode,
    externalParents: [...externalParents].sort(),
    issues: issues.sort((a, b) => a.blockHash < b.blockHash ? -1 : a.blockHash > b.blockHash ? 1 : 0),
  };
}

/** Execute canonical Block Graph verification or the deprecated adjacency-only compatibility form. */
export function validateGraph(seed: unknown, source: unknown, context: unknown): GraphVerification;
/** @deprecated Use validateGraph(seed, source, context) for canonical Graph verification. */
export function validateGraph(
  graph: Map<string, string[]> | Array<[string, string[]]>,
  context?: GraphValidationContext,
): GraphResult;
export function validateGraph(
  seedOrGraph: unknown,
  sourceOrContext?: unknown,
  context?: unknown,
): GraphVerification | GraphResult {
  if (seedOrGraph instanceof Map || Array.isArray(seedOrGraph)) {
    return validateGraphStructure(
      seedOrGraph as Map<string, string[]> | Array<[string, string[]]>,
      sourceOrContext as GraphValidationContext | undefined,
    );
  }
  return validateGraphVerification(seedOrGraph, sourceOrContext, context);
}

/**
 * Build a graph map from an array of block-like objects.
 */
export function buildGraph(
  blocks: Array<{ blockHash: string; parentHashes?: string[] }>,
): Map<string, string[]> {
  return prepareGraph(blocks.map((block) => [block.blockHash, block.parentHashes ?? []]));
}

/**
 * Verify the authenticity of a chain of blocks.
 *
 * For each block, verifies:
 *   1. Its hash actually matches its content (not just structurally valid)
 *   2. Every parent hash resolves to a block in the set
 *   3. Every resolved parent's hash is also authentic
 *
 * This is stronger than validateGraph — it proves the graph is real,
 * not just well-formed.
 */
export function verifyGraph(
  blocks: Array<{ blockHash: string; content: unknown; parentHashes?: string[] }>,
  computeHash: (content: unknown, parentHashes: string[]) => string,
): VerifyResult {
  if (typeof computeHash !== "function") {
    throw protocolError(ErrorCode.INVALID_GRAPH, "computeHash function is required");
  }

  const byHash = new Map<string, { blockHash: string; content: unknown; parentHashes?: string[] }>();
  const duplicateHashes = new Set<string>();
  for (const b of blocks) {
    const hash = normalize(b.blockHash);
    if (byHash.has(hash)) duplicateHashes.add(hash);
    else byHash.set(hash, b);
  }

  let verified = 0;
  const broken: VerifyResult["broken"] = [...duplicateHashes]
    .sort()
    .map((blockHash) => ({ blockHash, reason: "duplicate_block" }));

  for (const b of blocks) {
    const hash = normalize(b.blockHash);
    if (duplicateHashes.has(hash)) continue;

    // Verify the block's own hash
    const expected = computeHash(b.content, b.parentHashes ?? []);
    if (expected !== hash) {
      broken.push({ blockHash: hash, reason: "hash_mismatch", expected });
      continue;
    }

    // Verify all parents exist in the set
    let parentsBroken = false;
    for (const parentHash of b.parentHashes ?? []) {
      const ph = normalize(parentHash);
      if (!byHash.has(ph)) {
        broken.push({ blockHash: hash, reason: "parent_not_found", parentHash: ph });
        parentsBroken = true;
      }
    }

    if (!parentsBroken) verified++;
  }

  return {
    ok: broken.length === 0,
    verified,
    broken: broken.sort((left, right) => (
      left.blockHash.localeCompare(right.blockHash)
      || left.reason.localeCompare(right.reason)
      || (left.parentHash ?? "").localeCompare(right.parentHash ?? "")
    )),
  };
}

/**
 * Add a single block to an existing graph without rebuilding.
 */
export function addBlockToGraph(
  block: { blockHash: string; parentHashes?: string[] },
  graph: Map<string, string[]>,
): Map<string, string[]> {
  const blockHash = normalizeHash(block.blockHash);
  for (const existingHash of graph.keys()) {
    if (normalizeHash(existingHash) === blockHash) {
      throw protocolError(ErrorCode.DUPLICATE_BLOCK, `Graph already contains ${blockHash}`);
    }
  }
  const parents = (block.parentHashes ?? []).map(normalizeHash);
  if (new Set(parents).size !== parents.length) {
    throw protocolError(ErrorCode.DUPLICATE_PARENT, "Graph entry contains duplicate parent hashes");
  }
  graph.set(blockHash, parents.sort());
  return graph;
}

/**
 * Validate a single new block against an existing graph.
 *
 * This is O(k) where k = number of parents — much faster than
 * re-validating the entire graph for real-time agent pipelines.
 */
export function validateIncrementalBlock(
  block: { blockHash: string; parentHashes?: string[] },
  existingGraph: Map<string, string[]>,
  context?: GraphValidationContext,
): LineageResult {
  validationMode(context);
  const hash = normalizeHash(block.blockHash);
  const preparedGraph = prepareGraph(existingGraph);
  const knownHashes = new Set(preparedGraph.keys());

  const { unique, duplicates, selfRef, missing, external } = classifyParents(hash, block.parentHashes ?? [], knownHashes, context);

  // Check if adding this block would introduce a cycle:
  // walk backwards through existing ancestors — if any can reach this hash, it's a cycle.
  let cycle = selfRef;
  if (!cycle) {
    const visited = new Set<string>();
    const stack = [...unique.filter((p) => preparedGraph.has(p))];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === hash) { cycle = true; break; }
      if (visited.has(current)) continue;
      visited.add(current);
      for (const parent of preparedGraph.get(current) ?? []) stack.push(parent);
    }
  }

  return {
    checked: true,
    status: lineageStatus(duplicates, missing, selfRef || cycle),
    ok: duplicates.length === 0 && missing.length === 0 && !selfRef && !cycle,
    blockHash: hash,
    parents: unique,
    duplicates,
    missing,
    external,
    selfRef,
    cycle,
  };
}

// ── Internals ──

const normalize = normalizeHashLenient;

interface ClassifiedParents {
  unique: string[];
  duplicates: string[];
  selfRef: boolean;
  missing: string[];
  external: string[];
}

/**
 * Normalize, deduplicate, and classify a block's parent hashes.
 * Shared by validateLineage and validateIncrementalBlock.
 */
function classifyParents(
  blockHash: string,
  parentHashes: string[],
  knownHashes: Set<string> | undefined,
  context?: GraphValidationContext,
): ClassifiedParents {
  if (!Array.isArray(parentHashes)) {
    throw protocolError(ErrorCode.INVALID_HASH, "parentHashes must be an array");
  }
  const raw = parentHashes.map(normalizeHash);
  return classifyPreparedParents(
    blockHash,
    raw,
    knownHashes,
    validationMode(context),
    normalizedExternalParents(context),
  );
}

function lineageStatus(
  duplicates: string[],
  missing: string[],
  invalidRelationship: boolean,
): GraphValidationStatus {
  if (duplicates.length > 0 || invalidRelationship) return "invalid";
  if (missing.length > 0) return "incomplete";
  return "valid";
}

function classifyPreparedParents(
  blockHash: string,
  raw: string[],
  knownHashes: Set<string> | undefined,
  mode: "closed-world" | "open-world",
  declaredExternal: Set<string>,
): ClassifiedParents {
  const unique = [...new Set(raw)].sort();

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const p of raw) {
    if (seen.has(p)) duplicates.push(p);
    seen.add(p);
  }

  const selfRef = unique.includes(blockHash);
  const unresolved = knownHashes === undefined ? [] : unique.filter((p) => !knownHashes.has(p));
  const external = mode === "open-world" ? unresolved.filter((p) => declaredExternal.has(p)) : [];
  const missing = unresolved.filter((p) => !external.includes(p));

  return {
    unique,
    duplicates: [...new Set(duplicates)].sort(),
    selfRef,
    missing: missing.sort(),
    external: external.sort(),
  };
}

/**
 * Single-pass cycle detection for the entire graph. O(V+E).
 * Returns the set of nodes that participate in a cycle.
 */
function detectAllCycles(graph: Map<string, string[]>): Set<string> {
  const inCycle = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();
  for (const start of graph.keys()) {
    if (state.get(start) === 2) continue;
    const stack: Array<{ node: string; next: number }> = [{ node: start, next: 0 }];
    const path: string[] = [start];
    state.set(start, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const parents = graph.get(frame.node) ?? [];
      if (frame.next >= parents.length) {
        state.set(frame.node, 2);
        stack.pop();
        path.pop();
        continue;
      }
      const parent = normalize(parents[frame.next++]);
      if (state.get(parent) === 1) {
        const cycleStart = path.lastIndexOf(parent);
        for (const node of path.slice(cycleStart)) inCycle.add(node);
      } else if (state.get(parent) !== 2 && graph.has(parent)) {
        state.set(parent, 1);
        stack.push({ node: parent, next: 0 });
        path.push(parent);
      }
    }
  }
  return inCycle;
}

function validationMode(context?: GraphValidationContext): "closed-world" | "open-world" {
  const mode = (context?.validationMode as string | undefined) ?? "closed-world";
  if (mode !== "closed-world" && mode !== "open-world") {
    throw protocolError(ErrorCode.INVALID_GRAPH, "validationMode must be closed-world or open-world");
  }
  return mode;
}

function normalizedExternalParents(context?: GraphValidationContext): Set<string> {
  const entries = context?.externalParents ?? [];
  if (!Array.isArray(entries)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "externalParents must be an array");
  }
  return new Set(entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || typeof entry.hash !== "string") {
      throw protocolError(ErrorCode.INVALID_HASH, "external parent hash must be a string");
    }
    return normalizeHash(entry.hash);
  }));
}

function prepareGraph(
  graph: Map<string, string[]> | Array<[string, string[]]>,
): Map<string, string[]> {
  const entries = graph instanceof Map ? [...graph.entries()] : graph;
  if (!Array.isArray(entries)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "graph must be a Map or entry array");
  }

  const prepared = new Map<string, string[]>();
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw protocolError(ErrorCode.INVALID_GRAPH, "graph entries must contain a key and parent array");
    }
    const [rawHash, rawParents] = entry;
    const hash = normalizeHash(rawHash);
    if (prepared.has(hash)) {
      throw protocolError(ErrorCode.DUPLICATE_BLOCK, "distinct Graph keys normalize to " + hash);
    }
    if (!Array.isArray(rawParents)) {
      throw protocolError(ErrorCode.INVALID_HASH, "Graph parentHashes must be an array");
    }
    const parents = rawParents.map(normalizeHash);
    if (new Set(parents).size !== parents.length) {
      throw protocolError(ErrorCode.DUPLICATE_PARENT, "Graph entry contains duplicate parent hashes");
    }
    prepared.set(hash, parents.sort());
  }
  return prepared;
}
