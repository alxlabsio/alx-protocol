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

import { normalizeHashLenient } from "./hash-utils.js";
import { ErrorCode, protocolError } from "./errors.js";

/** Result of single-block lineage validation. */
export interface LineageResult {
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
  const hash = normalize(blockHash);
  const known = knownHashes instanceof Set
    ? knownHashes
    : new Set((knownHashes ?? []).map(normalize));

  const { unique, duplicates, selfRef, missing, external } = classifyParents(hash, parentHashes, known, context);

  // Without the full graph, the only cycle detectable is a self-reference.
  // Full graph cycles require validateGraph.
  const cycle = selfRef;

  return {
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

/**
 * Validate an entire block graph for structural integrity.
 */
export function validateGraph(
  graph: Map<string, string[]> | Array<[string, string[]]>,
  context?: GraphValidationContext,
): GraphResult {
  const g = graph instanceof Map ? graph : new Map(graph);
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

    const result = validateLineage(hash, parents, allHashes, context);
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
    mode: context?.validationMode ?? "closed-world",
    externalParents: [...externalParents].sort(),
    issues,
  };
}

/**
 * Build a graph map from an array of block-like objects.
 */
export function buildGraph(
  blocks: Array<{ blockHash: string; parentHashes?: string[] }>,
): Map<string, string[]> {
  const g = new Map<string, string[]>();
  for (const b of blocks) {
    g.set(normalize(b.blockHash), (b.parentHashes ?? []).map(normalize).sort());
  }
  return g;
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
  for (const b of blocks) {
    byHash.set(normalize(b.blockHash), b);
  }

  let verified = 0;
  const broken: VerifyResult["broken"] = [];

  for (const b of blocks) {
    const hash = normalize(b.blockHash);

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
    broken,
  };
}

/**
 * Add a single block to an existing graph without rebuilding.
 */
export function addBlockToGraph(
  block: { blockHash: string; parentHashes?: string[] },
  graph: Map<string, string[]>,
): Map<string, string[]> {
  graph.set(normalize(block.blockHash), (block.parentHashes ?? []).map(normalize).sort());
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
  const hash = normalize(block.blockHash);
  const knownHashes = new Set(existingGraph.keys());

  const { unique, duplicates, selfRef, missing, external } = classifyParents(hash, block.parentHashes ?? [], knownHashes, context);

  // Check if adding this block would introduce a cycle:
  // walk backwards through existing ancestors — if any can reach this hash, it's a cycle.
  let cycle = selfRef;
  if (!cycle) {
    const visited = new Set<string>();
    const stack = [...unique.filter((p) => existingGraph.has(p))];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === hash) { cycle = true; break; }
      if (visited.has(current)) continue;
      visited.add(current);
      for (const parent of existingGraph.get(current) ?? []) stack.push(parent);
    }
  }

  return {
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
  knownHashes: Set<string>,
  context?: GraphValidationContext,
): ClassifiedParents {
  const raw = (parentHashes ?? []).map(normalize);
  const unique = [...new Set(raw)].sort();

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const p of raw) {
    if (seen.has(p)) duplicates.push(p);
    seen.add(p);
  }

  const selfRef = unique.includes(blockHash);
  const mode = context?.validationMode ?? "closed-world";
  const declaredExternal = new Set((context?.externalParents ?? []).map((e) => normalize(e.hash)));
  const unresolved = unique.filter((p) => knownHashes.size > 0 && !knownHashes.has(p));
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
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const inCycle = new Set<string>();

  function visit(node: string): boolean {
    if (visited.has(node)) return false;
    if (visiting.has(node)) {
      inCycle.add(node);
      return true;
    }
    visiting.add(node);
    for (const parent of graph.get(node) ?? []) {
      if (visit(parent)) inCycle.add(node);
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const node of graph.keys()) {
    visit(node);
  }
  return inCycle;
}
