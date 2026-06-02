/**
 * block-trace.ts — Lineage trace resolution.
 *
 * Given a root block and its lineage graph, resolve the complete
 * lineage structure. The protocol returns the trace —
 * every node reached, every edge walked, every depth measured.
 *
 * The protocol does not interpret "fair." It resolves "how was this built."
 * Applications decide what to do with the structure.
 *
 * Semantics:
 *   - nodes = all reachable ancestors including root
 *   - edges = only actual graph edges among reachable nodes
 *   - minDepth/maxDepth = shortest/longest path from root to this node
 *   - pathCount = number of distinct paths from root to this node
 *
 * pathCount is computed correctly for diamond DAGs via two-pass approach:
 *   Pass 1: BFS to discover all reachable nodes + edges + depths
 *   Pass 2: Topological-order propagation to compute exact path counts
 *
 * Invariants:
 *   - Same root + same graph → same trace, always
 *   - Every reachable node is included
 *   - Unreachable nodes are excluded
 *   - Cycles are detected and reported, not traversed
 *   - pathCount is exact (not approximated)
 */

import { normalizeHashLenient, normalizeHash, HASH_PATTERN } from "./hash-utils.js";
import { ErrorCode, protocolError } from "./errors.js";

/** A node in an attribution trace. */
export interface TraceNode {
  hash: string;
  minDepth: number;
  maxDepth: number;
  pathCount: number;
  parentCount: number;
  childCount: number;
}

/** A directed edge in an attribution trace. */
export interface TraceEdge {
  from: string;
  to: string;
}

/** Complete attribution trace from a root block through a graph. */
export interface AttributionTrace {
  root: string;
  validationMode: "closed-world" | "open-world";
  complete: boolean;
  nodes: TraceNode[];
  edges: TraceEdge[];
  leaves: string[];
  missingParents: string[];
  externalParents: string[];
  maxDepth: number;
  cycle: boolean;
  precisionLoss: boolean;
}

export interface TraceVerification {
  ok: boolean;
  issues: string[];
}

export interface TraceContext {
  validationMode?: "closed-world" | "open-world";
  externalParents?: Array<{ hash: string }>;
}

/**
 * Resolve the full lineage trace from a root block through a graph.
 */
export function traceAttribution(rootHash: string, graph: Map<string, string[]>, context?: TraceContext): AttributionTrace {
  const root = normalize(rootHash);
  if (!root || !HASH_PATTERN.test(root)) throw protocolError(ErrorCode.ROOT_HASH_REQUIRED, "rootHash must be a valid 0x-prefixed 64-char hex hash");
  if (!(graph instanceof Map)) throw protocolError(ErrorCode.INVALID_GRAPH, "graph must be a Map<string, string[]>");

  const mode = context?.validationMode ?? "closed-world";
  const declaredExternal = new Set((context?.externalParents ?? []).map((p) => normalize(p.hash)));

  const cycleDetected = detectCycleFromRoot(root, graph);
  const { discovered, edgeList, childCounts, parentCounts, missingParents, externalParents } =
    bfsDiscover(root, graph, mode, declaredExternal);
  const { minDepths, maxDepths, pathCounts, precisionLoss } =
    propagateDepthsAndPaths(root, discovered, edgeList, graph);

  return buildTraceOutput({
    root, mode, cycleDetected, discovered, edgeList, childCounts, parentCounts,
    missingParents, externalParents, minDepths, maxDepths, pathCounts, precisionLoss,
  });
}

// ── Private phases ──

/** Phase 0: DFS cycle pre-check. Returns true if any cycle is reachable from root. O(V+E). */
function detectCycleFromRoot(root: string, graph: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let found = false;

  function visit(node: string): void {
    if (found || visited.has(node)) return;
    if (visiting.has(node)) { found = true; return; }
    visiting.add(node);
    for (const p of graph.get(node) ?? []) visit(normalize(p));
    visiting.delete(node);
    visited.add(node);
  }

  visit(root);
  return found;
}

interface BfsResult {
  discovered: Set<string>;
  edgeList: TraceEdge[];
  childCounts: Map<string, number>;
  parentCounts: Map<string, number>;
  missingParents: Set<string>;
  externalParents: Set<string>;
}

/** Phase 1: BFS to discover all reachable nodes, edges, and missing/external parents. O(V+E). */
function bfsDiscover(
  root: string,
  graph: Map<string, string[]>,
  mode: string,
  declaredExternal: Set<string>,
): BfsResult {
  const discovered = new Set<string>([root]);
  const edgeSet = new Set<string>();
  const edgeList: TraceEdge[] = [];
  const childCounts = new Map<string, number>();
  const parentCounts = new Map<string, number>();
  const missingParents = new Set<string>();
  const externalParents = new Set<string>();

  const queue: string[] = [root];
  let head = 0;

  while (head < queue.length) {
    const hash = queue[head++];
    const parents = graph.get(hash) ?? [];
    parentCounts.set(hash, parents.length);

    for (const parent of parents) {
      const p = normalize(parent);
      const edgeKey = `${hash}\0${p}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edgeList.push({ from: hash, to: p });
        childCounts.set(p, (childCounts.get(p) ?? 0) + 1);
      }
      if (!graph.has(p)) {
        if (mode === "open-world" && declaredExternal.has(p)) externalParents.add(p);
        else missingParents.add(p);
        continue;
      }
      if (!discovered.has(p)) {
        discovered.add(p);
        queue.push(p);
      }
    }
  }

  return { discovered, edgeList, childCounts, parentCounts, missingParents, externalParents };
}

interface PropagationResult {
  minDepths: Map<string, number>;
  maxDepths: Map<string, number>;
  pathCounts: Map<string, number>;
  precisionLoss: boolean;
}

/** Phase 2: Kahn's topological sort to propagate min/max depths and exact path counts. O(V+E). */
function propagateDepthsAndPaths(
  root: string,
  discovered: Set<string>,
  edgeList: TraceEdge[],
  graph: Map<string, string[]>,
): PropagationResult {
  const minDepths = new Map<string, number>([[root, 0]]);
  const maxDepths = new Map<string, number>([[root, 0]]);
  const pathCounts = new Map<string, number>([[root, 1]]);

  const inDegree = new Map<string, number>();
  for (const hash of discovered) inDegree.set(hash, 0);
  for (const edge of edgeList) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);

  const queue: string[] = [];
  for (const [hash, deg] of inDegree) { if (deg === 0) queue.push(hash); }
  let head = 0;
  let precisionLoss = false;

  while (head < queue.length) {
    const hash = queue[head++];
    const depth = minDepths.get(hash) ?? 0;
    const maxD = maxDepths.get(hash) ?? 0;
    const myPaths = pathCounts.get(hash) ?? 0;

    for (const parent of graph.get(hash) ?? []) {
      const p = normalize(parent);
      if (!discovered.has(p)) continue;
      minDepths.set(p, Math.min(minDepths.get(p) ?? Infinity, depth + 1));
      maxDepths.set(p, Math.max(maxDepths.get(p) ?? 0, maxD + 1));
      const accumulated = (pathCounts.get(p) ?? 0) + myPaths;
      if (accumulated > Number.MAX_SAFE_INTEGER) precisionLoss = true;
      pathCounts.set(p, accumulated);
      const remaining = (inDegree.get(p) ?? 1) - 1;
      inDegree.set(p, remaining);
      if (remaining === 0) queue.push(p);
    }
  }

  return { minDepths, maxDepths, pathCounts, precisionLoss };
}

/** Assemble the final AttributionTrace from computed phase data. */
function buildTraceOutput(data: {
  root: string;
  mode: string;
  cycleDetected: boolean;
  discovered: Set<string>;
  edgeList: TraceEdge[];
  childCounts: Map<string, number>;
  parentCounts: Map<string, number>;
  missingParents: Set<string>;
  externalParents: Set<string>;
  minDepths: Map<string, number>;
  maxDepths: Map<string, number>;
  pathCounts: Map<string, number>;
  precisionLoss: boolean;
}): AttributionTrace {
  const { root, mode, cycleDetected, discovered, edgeList, childCounts, parentCounts,
          missingParents, externalParents, minDepths, maxDepths, pathCounts, precisionLoss } = data;

  const nodes: TraceNode[] = [];
  const leaves: string[] = [];
  let globalMaxDepth = 0;

  for (const hash of discovered) {
    const minD = minDepths.get(hash) ?? 0;
    const maxD = maxDepths.get(hash) ?? 0;
    const pCount = parentCounts.get(hash) ?? 0;
    if (maxD > globalMaxDepth) globalMaxDepth = maxD;
    nodes.push({
      hash,
      minDepth:    minD,
      maxDepth:    maxD,
      pathCount:   pathCounts.get(hash) ?? 0,
      parentCount: pCount,
      childCount:  childCounts.get(hash) ?? 0,
    });
    if (pCount === 0) leaves.push(hash);
  }

  // Deterministic sort: by minDepth, then hash (byte-order, not locale-aware)
  const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  nodes.sort((a, b) => a.minDepth !== b.minDepth ? a.minDepth - b.minDepth : cmp(a.hash, b.hash));
  edgeList.sort((a, b) => a.from !== b.from ? cmp(a.from, b.from) : cmp(a.to, b.to));
  leaves.sort();

  return {
    root,
    validationMode: mode as "closed-world" | "open-world",
    complete: missingParents.size === 0 && externalParents.size === 0 && !cycleDetected,
    nodes,
    edges: edgeList,
    leaves,
    missingParents: [...missingParents].sort(),
    externalParents: [...externalParents].sort(),
    maxDepth: globalMaxDepth,
    cycle: cycleDetected,
    precisionLoss,
  };
}

export function verifyTrace(trace: AttributionTrace, graph: Map<string, string[]>, context?: TraceContext): TraceVerification {
  const expected = traceAttribution(trace.root, graph, context);
  const issues: string[] = [];
  const nodeHashes = trace.nodes.map((node) => node.hash);
  if (new Set(nodeHashes).size !== nodeHashes.length) issues.push("duplicate_nodes");
  const edgeKeys = trace.edges.map((edge) => `${edge.from}\0${edge.to}`);
  if (new Set(edgeKeys).size !== edgeKeys.length) issues.push("duplicate_edges");
  if (new Set(trace.leaves).size !== trace.leaves.length) issues.push("duplicate_leaves");
  if (JSON.stringify(trace.nodes) !== JSON.stringify(expected.nodes)) issues.push("nodes_mismatch");
  if (JSON.stringify(trace.edges) !== JSON.stringify(expected.edges)) issues.push("edges_mismatch");
  if (JSON.stringify(trace.leaves) !== JSON.stringify(expected.leaves)) issues.push("leaves_mismatch");
  if (trace.validationMode !== expected.validationMode) issues.push("validation_mode_mismatch");
  if (trace.complete !== expected.complete) issues.push("complete_mismatch");
  if (JSON.stringify(trace.missingParents) !== JSON.stringify(expected.missingParents)) issues.push("missing_parents_mismatch");
  if (JSON.stringify(trace.externalParents) !== JSON.stringify(expected.externalParents)) issues.push("external_parents_mismatch");
  if (trace.maxDepth !== expected.maxDepth) issues.push("max_depth_mismatch");
  if (trace.cycle !== expected.cycle) issues.push("cycle_mismatch");
  return { ok: issues.length === 0, issues };
}

const normalize = normalizeHashLenient;
