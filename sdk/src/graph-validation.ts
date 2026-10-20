/** Canonical ALX v1 Graph verification over a seed, finite Block source, and context. */

import { deriveBlockHash, deriveContentHash } from "./block.js";
import { ErrorCode, protocolError } from "./errors.js";
import type { ErrorCodeValue } from "./errors.js";
import { MAX_PARENTS, normalizeHash } from "./hash-utils.js";
import type { VerificationContext } from "./verification-context.js";

export type GraphValidationStatus =
  | "valid"
  | "invalid"
  | "incomplete"
  | "resource_limit_reached";

export interface GraphBlockCandidate {
  blockHash: string;
  contentHash: string;
  parentHashes: unknown[];
  content: unknown;
  protocolVersion: string;
}

export interface FiniteGraphBlockSource {
  kind: "finite";
  blocks: GraphBlockCandidate[];
}

export interface GraphValidationIssue {
  code: ErrorCodeValue;
  blockHash: string;
}

export interface GraphLimitReached {
  kind:
    | "maxBlocks"
    | "maxEdges"
    | "maxBytes"
    | "time"
    | "memory"
    | "cryptographicWork"
    | "concurrency"
    | "other";
  name?: string;
}

export interface GraphVerification {
  protocolVersion: "1";
  checked: true;
  status: GraphValidationStatus;
  context: VerificationContext;
  blocksExamined: number;
  edgesExamined: number;
  missingParents: string[];
  externalParents: string[];
  issues: GraphValidationIssue[];
  limitReached?: GraphLimitReached;
}

interface TraversalItem {
  block: GraphBlockCandidate;
  blockHash: string;
  depth: number;
}

interface InspectedBlock {
  parents: Array<string | undefined>;
}

const BLOCK_FIELDS = new Set(["blockHash", "contentHash", "parentHashes", "content", "protocolVersion"]);
const CONTEXT_FIELDS = new Set([
  "protocolVersion",
  "validationMode",
  "graphRoot",
  "maxDepth",
  "resourceLimits",
  "extensions",
  "externalParents",
]);
const EXTERNAL_PARENT_FIELDS = new Set(["hash", "reason", "declaredBy", "requiredForFullValidation"]);
const EXTERNAL_REASONS = new Set([
  "external-boundary",
  "private-boundary",
  "unavailable-boundary",
  "unknown-boundary",
]);

/** Execute the normative validateGraph(seed, source, context) operation. */
export function validateGraphVerification(
  seedInput: unknown,
  sourceInput: unknown,
  contextInput: unknown,
): GraphVerification {
  const context = validateContext(contextInput);
  const seedHash = validateSeedIdentity(seedInput, context.graphRoot);
  const seed = validateBlockCandidateEnvelope(seedInput, ErrorCode.SCHEMA_INVALID, "seed");
  const source = validateSource(sourceInput);

  const issues = new Map<string, GraphValidationIssue>();
  const missingParents = new Set<string>();
  const externalParents = new Set<string>();
  const examined = new Set<string>();
  const scheduled = new Set<string>([seedHash]);
  const adjacency = new Map<string, Set<string>>();
  const declaredExternal = new Set(context.externalParents.map((entry) => entry.hash));
  const sourceIndex = indexSourceBlocks(source);
  let blocksExamined = 0;
  let edgesExamined = 0;
  let limitReached: GraphLimitReached | undefined;
  let frontier: TraversalItem[] = [{ block: seed, blockHash: seedHash, depth: 0 }];

  const addIssue = (code: ErrorCodeValue, blockHash: string): void => {
    issues.set(`${blockHash}\u0000${code}`, { code, blockHash });
  };

  const lookup = (requestedHash: string): GraphBlockCandidate[] => {
    return sourceIndex.get(requestedHash) ?? [];
  };

  traversal: while (frontier.length > 0) {
    frontier.sort((left, right) => compareAscii(left.blockHash, right.blockHash));
    const next = new Map<string, TraversalItem>();

    for (const item of frontier) {
      if (context.resourceLimits?.maxBlocks !== undefined && blocksExamined >= context.resourceLimits.maxBlocks) {
        limitReached = { kind: "maxBlocks" };
        break traversal;
      }

      blocksExamined += 1;
      examined.add(item.blockHash);
      adjacency.set(item.blockHash, new Set());
      const inspected = inspectBlock(item.block, item.blockHash, addIssue);

      for (const parentHash of inspected.parents) {
        if (context.resourceLimits?.maxEdges !== undefined && edgesExamined >= context.resourceLimits.maxEdges) {
          limitReached = { kind: "maxEdges" };
          break traversal;
        }
        edgesExamined += 1;
        if (parentHash === undefined) continue;
        adjacency.get(item.blockHash)!.add(parentHash);

        if (item.depth >= (context.maxDepth ?? Number.MAX_SAFE_INTEGER)) continue;
        if (scheduled.has(parentHash)) continue;

        const candidates = lookup(parentHash);
        if (candidates.length > 1) {
          addIssue(ErrorCode.DUPLICATE_BLOCK, parentHash);
          scheduled.add(parentHash);
          continue;
        }
        if (candidates.length === 0) {
          if (context.validationMode === "open-world" && declaredExternal.has(parentHash)) {
            externalParents.add(parentHash);
          } else {
            missingParents.add(parentHash);
          }
          scheduled.add(parentHash);
          continue;
        }

        scheduled.add(parentHash);
        next.set(parentHash, {
          block: candidates[0],
          blockHash: parentHash,
          depth: item.depth + 1,
        });
      }
    }

    frontier = [...next.values()];
  }

  for (const component of cyclicComponents(adjacency, examined)) {
    addIssue(ErrorCode.GRAPH_CYCLE, component[0]);
  }

  const sortedIssues = [...issues.values()].sort((left, right) =>
    compareAscii(left.blockHash, right.blockHash) || compareAscii(left.code, right.code));
  const status: GraphValidationStatus = sortedIssues.length > 0
    ? "invalid"
    : limitReached
      ? "resource_limit_reached"
      : missingParents.size > 0
        ? "incomplete"
        : "valid";

  return {
    protocolVersion: "1",
    checked: true,
    status,
    context,
    blocksExamined,
    edgesExamined,
    missingParents: [...missingParents].sort(compareAscii),
    externalParents: [...externalParents].sort(compareAscii),
    issues: sortedIssues,
    ...(limitReached ? { limitReached } : {}),
  };
}

function inspectBlock(
  block: GraphBlockCandidate,
  claimedHash: string,
  addIssue: (code: ErrorCodeValue, blockHash: string) => void,
): InspectedBlock {
  if (block.protocolVersion !== "1") addIssue(ErrorCode.UNSUPPORTED_VERSION, claimedHash);

  const normalizedParents: Array<string | undefined> = [];
  const validParents: string[] = [];
  let allParentsValid = true;
  for (const parent of block.parentHashes) {
    if (typeof parent !== "string") {
      addIssue(ErrorCode.INVALID_HASH, claimedHash);
      normalizedParents.push(undefined);
      allParentsValid = false;
      continue;
    }
    try {
      const normalized = normalizeHash(parent);
      normalizedParents.push(normalized);
      validParents.push(normalized);
    } catch {
      addIssue(ErrorCode.INVALID_HASH, claimedHash);
      normalizedParents.push(undefined);
      allParentsValid = false;
    }
  }

  const distinctParents = [...new Set(validParents)];
  const sortedParents = [...distinctParents].sort(compareAscii);
  if (distinctParents.length !== validParents.length) addIssue(ErrorCode.DUPLICATE_PARENT, claimedHash);
  if (sortedParents.length > MAX_PARENTS) addIssue(ErrorCode.TOO_MANY_PARENTS, claimedHash);
  const rawParentsCanonical = block.parentHashes.every(
    (parent, index) => typeof parent === "string" && parent === normalizedParents[index],
  );
  if (
    allParentsValid
    && (JSON.stringify(distinctParents) !== JSON.stringify(sortedParents) || !rawParentsCanonical)
  ) {
    addIssue(ErrorCode.PARENT_HASHES_UNSORTED, claimedHash);
  }
  if (sortedParents.includes(claimedHash)) addIssue(ErrorCode.SELF_PARENT, claimedHash);

  let contentDerivable = true;
  try {
    const computedContentHash = deriveContentHash(block.content);
    try {
      const storedContentHash = normalizeHash(block.contentHash);
      if (block.contentHash !== storedContentHash || storedContentHash !== computedContentHash) {
        addIssue(ErrorCode.CONTENT_HASH_MISMATCH, claimedHash);
      }
    } catch {
      addIssue(ErrorCode.INVALID_HASH, claimedHash);
    }
  } catch {
    contentDerivable = false;
    addIssue(ErrorCode.SCHEMA_INVALID, claimedHash);
  }

  if (allParentsValid && sortedParents.length <= MAX_PARENTS && contentDerivable) {
    try {
      const computedBlockHash = deriveBlockHash(block.content, sortedParents);
      if (block.blockHash !== claimedHash || computedBlockHash !== claimedHash) {
        addIssue(ErrorCode.BLOCK_HASH_MISMATCH, claimedHash);
      }
    } catch {
      addIssue(ErrorCode.SCHEMA_INVALID, claimedHash);
    }
  }

  return {
    parents: [...normalizedParents].sort((left, right) => {
      if (left === undefined) return right === undefined ? 0 : -1;
      if (right === undefined) return 1;
      return compareAscii(left, right);
    }),
  };
}

function validateContext(input: unknown): VerificationContext {
  if (!isPlainRecord(input)) throw protocolError(ErrorCode.INVALID_GRAPH, "context must be an object");
  assertAllowedProperties(input, CONTEXT_FIELDS, ErrorCode.INVALID_GRAPH, "context");

  if (input.validationMode !== "closed-world" && input.validationMode !== "open-world") {
    throw protocolError(ErrorCode.INVALID_GRAPH, "validationMode must be closed-world or open-world");
  }
  if (input.protocolVersion !== "1") {
    throw protocolError(ErrorCode.UNSUPPORTED_VERSION, "context protocolVersion must be 1");
  }
  if (typeof input.graphRoot !== "string") {
    throw protocolError(ErrorCode.CONTEXT_ROOT_MISMATCH, "context graphRoot is required");
  }
  let graphRoot: string;
  try {
    graphRoot = normalizeHash(input.graphRoot);
  } catch {
    throw protocolError(ErrorCode.CONTEXT_ROOT_MISMATCH, "context graphRoot is invalid");
  }
  if (input.graphRoot !== graphRoot) {
    throw protocolError(ErrorCode.INVALID_HASH, "context graphRoot must be canonical");
  }
  if (!Array.isArray(input.externalParents)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "context externalParents must be an array");
  }
  if (input.validationMode === "closed-world" && input.externalParents.length > 0) {
    throw protocolError(
      ErrorCode.EXTERNAL_PARENT_IN_CLOSED_WORLD,
      "closed-world context cannot declare external parents",
    );
  }

  const externalHashes = new Set<string>();
  for (const boundary of input.externalParents) {
    if (!isPlainRecord(boundary)) {
      throw protocolError(ErrorCode.INVALID_GRAPH, "external parent boundary must be an object");
    }
    assertAllowedProperties(boundary, EXTERNAL_PARENT_FIELDS, ErrorCode.INVALID_GRAPH, "external parent boundary");
    if (
      typeof boundary.hash !== "string"
      || !EXTERNAL_REASONS.has(String(boundary.reason))
      || boundary.declaredBy !== "verification-context"
      || typeof boundary.requiredForFullValidation !== "boolean"
    ) {
      throw protocolError(ErrorCode.INVALID_GRAPH, "external parent boundary is malformed");
    }
    let normalized: string;
    try {
      normalized = normalizeHash(boundary.hash);
    } catch {
      throw protocolError(ErrorCode.INVALID_HASH, "external parent hash is invalid");
    }
    if (boundary.hash !== normalized || externalHashes.has(normalized)) {
      throw protocolError(ErrorCode.INVALID_GRAPH, "external parent hashes must be canonical and unique");
    }
    externalHashes.add(normalized);
  }

  if (input.maxDepth !== undefined && !isSafeIntegerAtLeast(input.maxDepth, 0)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "maxDepth must be a non-negative safe integer");
  }
  if (input.resourceLimits !== undefined) validateResourceLimits(input.resourceLimits);
  if (input.extensions !== undefined) {
    if (
      !Array.isArray(input.extensions)
      || input.extensions.some((extension) => (
        typeof extension !== "string"
        || [...extension].length < 1
        || [...extension].length > 128
      ))
      || new Set(input.extensions).size !== input.extensions.length
    ) {
      throw protocolError(ErrorCode.INVALID_GRAPH, "extensions must be unique non-empty strings");
    }
  }

  return input as unknown as VerificationContext;
}

function validateResourceLimits(input: unknown): void {
  if (!isPlainRecord(input)) throw protocolError(ErrorCode.INVALID_GRAPH, "resourceLimits must be an object");
  assertAllowedProperties(input, new Set(["maxBlocks", "maxEdges"]), ErrorCode.INVALID_GRAPH, "resourceLimits");
  if (Object.keys(input).length === 0) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "resourceLimits must not be empty");
  }
  if (input.maxBlocks !== undefined && !isSafeIntegerAtLeast(input.maxBlocks, 1)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "maxBlocks must be a positive safe integer");
  }
  if (input.maxEdges !== undefined && !isSafeIntegerAtLeast(input.maxEdges, 0)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "maxEdges must be a non-negative safe integer");
  }
}

function validateSeedIdentity(input: unknown, graphRoot: string): string {
  if (!isPlainRecord(input) || typeof input.blockHash !== "string") {
    throw protocolError(ErrorCode.CONTEXT_ROOT_MISMATCH, "seed blockHash is required");
  }
  let seedHash: string;
  try {
    seedHash = normalizeHash(input.blockHash);
  } catch {
    throw protocolError(ErrorCode.CONTEXT_ROOT_MISMATCH, "seed blockHash is invalid");
  }
  if (seedHash !== graphRoot) {
    throw protocolError(ErrorCode.CONTEXT_ROOT_MISMATCH, "seed blockHash does not equal context graphRoot");
  }
  return seedHash;
}

function validateSource(input: unknown): FiniteGraphBlockSource {
  if (!isPlainRecord(input)) throw protocolError(ErrorCode.INVALID_GRAPH, "source must be an object");
  assertAllowedProperties(input, new Set(["kind", "blocks"]), ErrorCode.INVALID_GRAPH, "source");
  if (input.kind !== "finite" || !Array.isArray(input.blocks)) {
    throw protocolError(ErrorCode.INVALID_GRAPH, "finite source requires a blocks array");
  }
  return {
    kind: "finite",
    blocks: input.blocks.map((candidate, index) =>
      validateBlockCandidateEnvelope(candidate, ErrorCode.INVALID_GRAPH, `source.blocks[${index}]`)),
  };
}

function indexSourceBlocks(source: FiniteGraphBlockSource): Map<string, GraphBlockCandidate[]> {
  const index = new Map<string, GraphBlockCandidate[]>();
  for (const candidate of source.blocks) {
    let normalized: string;
    try {
      normalized = normalizeHash(candidate.blockHash);
    } catch {
      // Source candidates outside the requested Graph are not validation findings.
      continue;
    }
    const matches = index.get(normalized);
    if (matches) matches.push(candidate);
    else index.set(normalized, [candidate]);
  }
  return index;
}

function validateBlockCandidateEnvelope(
  input: unknown,
  code: ErrorCodeValue,
  label: string,
): GraphBlockCandidate {
  if (!isPlainRecord(input)) throw protocolError(code, `${label} must be a Block candidate object`);
  assertAllowedProperties(input, BLOCK_FIELDS, code, label);
  if (
    typeof input.blockHash !== "string"
    || typeof input.contentHash !== "string"
    || !Array.isArray(input.parentHashes)
    || typeof input.protocolVersion !== "string"
    || !("content" in input)
  ) {
    throw protocolError(code, `${label} is not a complete Block candidate`);
  }
  return input as unknown as GraphBlockCandidate;
}

function cyclicComponents(
  adjacency: Map<string, Set<string>>,
  examined: Set<string>,
): string[][] {
  const nodes = [...examined].sort(compareAscii);
  const neighbors = new Map(nodes.map((node) => [
    node,
    [...(adjacency.get(node) ?? [])].filter((parent) => examined.has(parent)).sort(compareAscii),
  ]));
  const visited = new Set<string>();
  const finishOrder: string[] = [];

  for (const start of nodes) {
    if (visited.has(start)) continue;
    const stack: Array<{ node: string; expanded: boolean }> = [{ node: start, expanded: false }];
    while (stack.length > 0) {
      const frame = stack.pop()!;
      if (frame.expanded) {
        finishOrder.push(frame.node);
        continue;
      }
      if (visited.has(frame.node)) continue;
      visited.add(frame.node);
      stack.push({ node: frame.node, expanded: true });
      const adjacent = neighbors.get(frame.node) ?? [];
      for (let index = adjacent.length - 1; index >= 0; index -= 1) {
        if (!visited.has(adjacent[index])) stack.push({ node: adjacent[index], expanded: false });
      }
    }
  }

  const reverse = new Map(nodes.map((node) => [node, [] as string[]]));
  for (const [node, adjacent] of neighbors) {
    for (const parent of adjacent) reverse.get(parent)!.push(node);
  }
  for (const adjacent of reverse.values()) adjacent.sort(compareAscii);

  const assigned = new Set<string>();
  const components: string[][] = [];
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index];
    if (assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const node = stack.pop()!;
      component.push(node);
      for (const adjacent of reverse.get(node) ?? []) {
        if (!assigned.has(adjacent)) {
          assigned.add(adjacent);
          stack.push(adjacent);
        }
      }
    }
    if (component.length > 1) components.push(component.sort(compareAscii));
  }
  return components.sort((left, right) => compareAscii(left[0], right[0]));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedProperties(
  value: Record<string, unknown>,
  allowed: Set<string>,
  code: ErrorCodeValue,
  label: string,
): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw protocolError(code, `${label} contains an unsupported property`);
  }
}

function isSafeIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
