/**
 * Project-local CLI Block storage and state. This layer is non-normative.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

const STATE_VERSION = 2;
const MAX_RECENT = 20;

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find the nearest ancestor containing .alx. Use cwd when no project store exists.
 * @param {string} [cwd]
 */
export function findProjectRoot(cwd = process.cwd()) {
  const start = resolve(cwd);
  let current = start;

  while (true) {
    if (isDirectory(join(current, ".alx"))) return current;
    const parent = dirname(current);
    if (parent === current || current === parse(current).root) return start;
    current = parent;
  }
}

/** @param {string} [cwd] */
function stateDir(cwd = process.cwd()) {
  return join(findProjectRoot(cwd), ".alx");
}

/** @param {string} [cwd] */
export function blockStoreDir(cwd = process.cwd()) {
  return join(stateDir(cwd), "blocks");
}

/** @param {string} [cwd] */
export function stateFilePath(cwd = process.cwd()) {
  return join(stateDir(cwd), "state.json");
}

function emptyState() {
  return {
    version: STATE_VERSION,
    lastBlock: null,
    recent: [],
    blocks: {},
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.blockHash !== "string") {
    return null;
  }
  const blockHash = entry.blockHash.toLowerCase();
  return {
    blockHash,
    contentHash: typeof entry.contentHash === "string" ? entry.contentHash.toLowerCase() : null,
    parentHashes: Array.isArray(entry.parentHashes)
      ? entry.parentHashes.map((hash) => String(hash).toLowerCase())
      : [],
    path: typeof entry.path === "string" ? resolve(entry.path) : null,
    outputPaths: Array.isArray(entry.outputPaths)
      ? [...new Set(entry.outputPaths.map((path) => resolve(path)))].sort()
      : [],
    createdAt:
      typeof entry.createdAt === "string"
        ? entry.createdAt
        : typeof entry.at === "string"
          ? entry.at
          : null,
  };
}

function normalizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== "object") return state;

  if (raw.blocks && typeof raw.blocks === "object" && !Array.isArray(raw.blocks)) {
    for (const entry of Object.values(raw.blocks)) {
      const normalized = normalizeEntry(entry);
      if (normalized) state.blocks[normalized.blockHash] = normalized;
    }
  }

  for (const entry of Array.isArray(raw.recent) ? raw.recent : []) {
    const normalized = normalizeEntry(entry);
    if (normalized && !state.blocks[normalized.blockHash]) {
      state.blocks[normalized.blockHash] = normalized;
    }
  }

  const lastBlock = normalizeEntry(raw.lastBlock);
  if (lastBlock) {
    state.lastBlock = state.blocks[lastBlock.blockHash] ?? lastBlock;
    if (!state.blocks[lastBlock.blockHash]) state.blocks[lastBlock.blockHash] = lastBlock;
  }

  state.recent = (Array.isArray(raw.recent) ? raw.recent : [])
    .map(normalizeEntry)
    .filter(Boolean)
    .map((entry) => state.blocks[entry.blockHash] ?? entry)
    .slice(0, MAX_RECENT);
  state.version = STATE_VERSION;
  return state;
}

/**
 * @param {string} [cwd]
 * @returns {{ version: number, lastBlock: object|null, recent: object[], blocks: Record<string, object> }}
 */
export function loadCliState(cwd = process.cwd()) {
  const path = stateFilePath(cwd);
  if (!existsSync(path)) return emptyState();
  try {
    return normalizeState(JSON.parse(readFileSync(path, "utf-8")));
  } catch {
    return emptyState();
  }
}

/** Atomically write text to one filesystem path. */
function writeTextAtomic(path, text) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = absolute + "." + process.pid + ".tmp";
  try {
    writeFileSync(temporary, text);
    renameSync(temporary, absolute);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

function writeCliState(cwd, state) {
  const sortedBlocks = {};
  for (const hash of Object.keys(state.blocks).sort()) {
    sortedBlocks[hash] = state.blocks[hash];
  }
  writeTextAtomic(
    stateFilePath(cwd),
    JSON.stringify({ ...state, version: STATE_VERSION, blocks: sortedBlocks }, null, 2) + "\n",
  );
}

/**
 * Persist a Block in the content-addressed project store and update state.
 * @param {{ block: object, outPath?: string|null, cwd?: string }} params
 */
export function persistBlockWrite({ block, outPath = null, cwd = process.cwd() }) {
  if (!block?.blockHash || !block?.contentHash || !Array.isArray(block?.parentHashes)) {
    throw new Error("Cannot persist an incomplete Block");
  }

  const projectRoot = findProjectRoot(cwd);
  const blockHash = String(block.blockHash).toLowerCase();
  const canonicalPath = join(blockStoreDir(projectRoot), blockHash + ".block.json");
  const serialized = JSON.stringify(block, null, 2) + "\n";
  let reused = false;

  if (existsSync(canonicalPath)) {
    const existing = readFileSync(canonicalPath, "utf-8");
    if (existing !== serialized) {
      throw new Error("Local Block collision at " + canonicalPath);
    }
    reused = true;
  } else {
    writeTextAtomic(canonicalPath, serialized);
  }

  const explicitPath = outPath ? resolve(cwd, outPath) : null;
  if (explicitPath && explicitPath !== canonicalPath) {
    writeTextAtomic(explicitPath, serialized);
  }

  const state = loadCliState(projectRoot);
  const existingEntry = state.blocks[blockHash] ?? null;
  const outputPaths = new Set(existingEntry?.outputPaths ?? []);
  if (explicitPath && explicitPath !== canonicalPath) outputPaths.add(explicitPath);
  const entry = {
    blockHash,
    contentHash: String(block.contentHash).toLowerCase(),
    parentHashes: block.parentHashes.map((hash) => String(hash).toLowerCase()),
    path: canonicalPath,
    outputPaths: [...outputPaths].sort(),
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
  };

  state.blocks[blockHash] = entry;
  state.lastBlock = entry;
  state.recent = [
    entry,
    ...state.recent.filter((item) => item.blockHash !== blockHash),
  ].slice(0, MAX_RECENT);
  writeCliState(projectRoot, state);

  return {
    projectRoot,
    canonicalPath,
    explicitPath,
    entry,
    reused,
  };
}


/** @param {string} [cwd] @param {number} [limit] */
export function listRecentFromState(cwd = process.cwd(), limit = 10) {
  return loadCliState(cwd).recent.slice(0, limit);
}

/** @param {string} [cwd] */
export function listAllFromState(cwd = process.cwd()) {
  return Object.values(loadCliState(cwd).blocks).sort((a, b) => {
    const byTime = String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    return byTime || a.blockHash.localeCompare(b.blockHash);
  });
}

/**
 * Find indexed entries by a full hash or hexadecimal prefix.
 * @param {string} reference
 * @param {string} [cwd]
 */
export function findIndexedBlockEntries(reference, cwd = process.cwd()) {
  const normalized = String(reference).trim().toLowerCase();
  const needle = normalized.startsWith("0x") ? normalized.slice(2) : normalized;
  return Object.values(loadCliState(cwd).blocks)
    .filter((entry) => entry.blockHash.slice(2).startsWith(needle))
    .sort((a, b) => a.blockHash.localeCompare(b.blockHash));
}
