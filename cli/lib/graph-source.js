/** Load graph navigation data from the project index or a supplied JSON file. */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { CliInputError } from "./cli-args.js";
import { validateBlock } from "./cli-context.js";
import { parseStrictJsonBytes } from "./strict-json.js";
import {
  findProjectRoot,
  loadCliState,
  stateFilePath,
} from "./cli-state.js";

const HASH_RE = /^0x[a-f0-9]{64}$/i;
const HASH_PREFIX_RE = /^0x[a-f0-9]{4,64}$/i;

function normalizeHash(value, label) {
  const hash = String(value ?? "").toLowerCase();
  if (!HASH_RE.test(hash)) {
    throw new CliInputError(`${label} must be a 0x-prefixed 64-character hash`);
  }
  return hash;
}

function normalizeParents(value, label) {
  if (!Array.isArray(value)) throw new CliInputError(`${label} must be an array`);
  const normalized = value.map((hash) => normalizeHash(hash, label));
  if (new Set(normalized).size !== normalized.length) {
    throw new CliInputError(`${label} contains duplicate parent hashes`);
  }
  return normalized.sort();
}

function isReadableFile(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function availableEntryPath(entry) {
  const candidates = [entry?.path, ...(entry?.outputPaths ?? [])].filter(Boolean);
  return candidates.find(isReadableFile) ?? null;
}

function parseJsonFile(path, label) {
  let text;
  try {
    text = readFileSync(path);
  } catch (err) {
    throw new CliInputError(`Unable to read ${label}: ${err.message}`);
  }
  try {
    return parseStrictJsonBytes(text);
  } catch {
    throw new CliInputError(`${label} is not valid JSON`);
  }
}

function addNode(nodes, hash, parents, metadata) {
  const existing = nodes.get(hash);
  if (existing) {
    throw new CliInputError(`Graph source contains duplicate entries for ${hash}`);
  }
  nodes.set(hash, {
    blockHash: hash,
    parentHashes: parents,
    indexed: true,
    available: Boolean(metadata.available),
    path: metadata.path ?? null,
    contentType: metadata.contentType ?? null,
  });
}

export function loadLocalGraphSource(cwd = process.cwd()) {
  const projectRoot = findProjectRoot(cwd);
  const state = loadCliState(projectRoot);
  const nodes = new Map();

  for (const entry of Object.values(state.blocks)) {
    const hash = normalizeHash(entry.blockHash, "Indexed blockHash");
    addNode(
      nodes,
      hash,
      normalizeParents(entry.parentHashes ?? [], `parentHashes for ${hash}`),
      { available: Boolean(availableEntryPath(entry)), path: availableEntryPath(entry) },
    );
  }

  return {
    nodes,
    lastBlock: state.lastBlock?.blockHash?.toLowerCase() ?? null,
    descriptor: {
      type: "local-index",
      path: stateFilePath(projectRoot),
      globalCompleteness: "unknown",
    },
  };
}

export function loadGraphFileSource(file, cwd = process.cwd()) {
  const path = resolve(cwd, file);
  if (!isReadableFile(path)) throw new CliInputError(`Graph file not found: ${file}`);
  const data = parseJsonFile(path, "Graph file");
  const nodes = new Map();

  if (Array.isArray(data)) {
    for (const block of data) {
      if (!block || typeof block !== "object") {
        throw new CliInputError("Graph Block arrays may contain only Block objects");
      }
      let validation;
      try {
        validation = validateBlock(block);
      } catch {
        validation = { ok: false };
      }
      if (!validation.ok) {
        throw new CliInputError("Graph Block array contains an invalid or non-canonical Block");
      }
      const hash = normalizeHash(block.blockHash, "Block blockHash");
      addNode(nodes, hash, normalizeParents(block.parentHashes ?? [], `parentHashes for ${hash}`), {
        available: true,
        path,
        contentType:
          block.content && typeof block.content === "object" && block.content.type
            ? String(block.content.type)
            : null,
      });
    }
  } else if (data && typeof data === "object") {
    for (const [rawHash, rawParents] of Object.entries(data)) {
      const hash = normalizeHash(rawHash, "Graph key");
      addNode(nodes, hash, normalizeParents(rawParents, `Parents for ${hash}`), {
        available: false,
        path: null,
      });
    }
  } else {
    throw new CliInputError("Graph file must contain a Block array or a hash-to-parents object");
  }

  return {
    nodes,
    lastBlock: null,
    descriptor: {
      type: "graph-file",
      path,
      representation: Array.isArray(data) ? "block-array" : "adjacency-map",
      globalCompleteness: "unknown",
    },
  };
}

export function loadGraphSource({ file = null, cwd = process.cwd() } = {}) {
  return file ? loadGraphFileSource(file, cwd) : loadLocalGraphSource(cwd);
}

function readBlockReference(path) {
  const block = parseJsonFile(path, "Block file");
  if (!block || typeof block !== "object") throw new CliInputError("Block file must contain an object");
  let validation;
  try {
    validation = validateBlock(block);
  } catch {
    validation = { ok: false };
  }
  if (!validation.ok) throw new CliInputError("Block file contains an invalid or non-canonical Block");
  const blockHash = normalizeHash(block.blockHash, "Block blockHash");
  const parentHashes = normalizeParents(block.parentHashes ?? [], "Block parentHashes");
  return { blockHash, parentHashes, path };
}

function referencedHashes(source) {
  const hashes = new Set(source.nodes.keys());
  for (const node of source.nodes.values()) {
    for (const parent of node.parentHashes) hashes.add(parent);
  }
  return hashes;
}

export function resolveGraphReference(reference, source, cwd = process.cwd()) {
  const token = String(reference ?? "").trim();
  if (!token) throw new CliInputError("A graph Block reference is required");

  if (token === "@last") {
    const localLast = source.lastBlock ?? loadLocalGraphSource(cwd).lastBlock;
    if (!localLast) throw new CliInputError("No local Block is recorded for @last");
    return { blockHash: localLast, parentHashes: null, path: null };
  }

  const possiblePath = resolve(cwd, token);
  if (isReadableFile(possiblePath)) return readBlockReference(possiblePath);

  if (HASH_RE.test(token)) {
    const hash = token.toLowerCase();
    if (!referencedHashes(source).has(hash)) {
      throw new CliInputError(`Block ${hash} is not present or referenced in the selected graph source`);
    }
    return { blockHash: hash, parentHashes: null, path: null };
  }

  if (HASH_PREFIX_RE.test(token)) {
    const prefix = token.toLowerCase();
    const matches = [...source.nodes.keys()].filter((hash) => hash.startsWith(prefix)).sort();
    if (matches.length === 1) return { blockHash: matches[0], parentHashes: null, path: null };
    if (matches.length > 1) {
      throw new CliInputError(`Ambiguous blockHash prefix ${token} matches ${matches.length} Blocks: ${matches.join(", ")}`);
    }
    throw new CliInputError(`No indexed Block matches ${token} in the selected graph source`);
  }

  throw new CliInputError(`Unsupported graph Block reference: ${token}`);
}

export function graphMap(source, overlay = null) {
  const graph = new Map(
    [...source.nodes.values()].map((node) => [node.blockHash, [...node.parentHashes]]),
  );
  if (overlay?.parentHashes && !graph.has(overlay.blockHash)) {
    graph.set(overlay.blockHash, [...overlay.parentHashes]);
  }
  return graph;
}

export function reverseGraph(source) {
  const reverse = new Map();
  for (const node of source.nodes.values()) {
    for (const parent of node.parentHashes) {
      if (!reverse.has(parent)) reverse.set(parent, []);
      reverse.get(parent).push(node.blockHash);
    }
  }
  for (const children of reverse.values()) children.sort();
  return reverse;
}

export function navigationRecord(hash, depth, source) {
  const node = source.nodes.get(hash);
  return {
    blockHash: hash,
    depth,
    indexed: Boolean(node),
    available: Boolean(node?.available),
  };
}
