/** Resolve local Block references and parent hashes for CLI workflows. */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { CliInputError } from "./cli-args.js";
import { findIndexedBlockEntries, loadCliState, listRecentFromState } from "./cli-state.js";
import { readParentBlockHash } from "./block-workflow.js";

const HASH_RE = /^0x[a-f0-9]{64}$/i;
const HASH_PREFIX_RE = /^0x[a-f0-9]{4,64}$/i;

function availableEntryPath(entry) {
  const candidates = [entry?.path, ...(entry?.outputPaths ?? [])].filter(Boolean);
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function findBlockJsonFilesInCwd(cwd = process.cwd()) {
  const dir = resolve(cwd);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".block.json"))
    .map((name) => resolve(dir, name))
    .filter((path) => {
      try { return statSync(path).isFile(); } catch { return false; }
    })
    .sort();
}

function readHashFromFile(path) {
  try { return String(JSON.parse(readFileSync(path, "utf-8"))?.blockHash ?? "").toLowerCase(); }
  catch { return ""; }
}

export function findBlockFileByHash(cwd, hashOrPrefix) {
  const normalized = String(hashOrPrefix).trim().toLowerCase();
  const matches = new Map();
  for (const entry of findIndexedBlockEntries(normalized, cwd)) {
    const path = availableEntryPath(entry);
    if (path) matches.set(entry.blockHash, resolve(path));
  }
  for (const path of findBlockJsonFilesInCwd(cwd)) {
    const hash = readHashFromFile(path);
    if (!hash) continue;
    const needle = normalized.startsWith("0x") ? normalized.slice(2) : normalized;
    if (hash === normalized || hash.slice(2).startsWith(needle)) matches.set(hash, path);
  }
  if (matches.size === 1) return [...matches.values()][0];
  if (matches.size > 1) {
    throw new CliInputError("Ambiguous blockHash prefix " + hashOrPrefix + " matches " + matches.size + " Blocks: " + [...matches.keys()].join(", "));
  }
  return null;
}

export function resolveBlockReferenceToPath(token, opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const trimmed = String(token ?? "").trim();
  if (!trimmed) throw new CliInputError("A Block reference is required");

  if (trimmed === "@last" || trimmed === "@latest") {
    const path = availableEntryPath(loadCliState(cwd).lastBlock);
    if (!path) throw new CliInputError("No available local Block is recorded for " + trimmed + ".");
    return resolve(path);
  }
  if (trimmed === "@parent") {
    const lastPath = resolveBlockReferenceToPath("@last", opts);
    let lastBlock;
    try { lastBlock = JSON.parse(readFileSync(lastPath, "utf-8")); }
    catch { throw new CliInputError("Cannot read last Block file: " + lastPath); }
    const parents = Array.isArray(lastBlock.parentHashes) ? lastBlock.parentHashes : [];
    if (parents.length === 0) throw new CliInputError("Last Block has no parentHashes; @parent is undefined.");
    if (parents.length > 1) throw new CliInputError("Last Block has multiple parents; use an explicit hash or file.");
    return resolveBlockReferenceToPath(parents[0], opts);
  }
  if (HASH_PREFIX_RE.test(trimmed)) {
    const path = findBlockFileByHash(cwd, trimmed);
    if (path) return path;
    const hints = listRecentFromState(cwd, 5).map((entry) => entry.blockHash).join(", ");
    const suffix = hints ? " Recent: " + hints + "." : "";
    throw new CliInputError("No available local Block matches " + trimmed + "." + suffix);
  }
  const path = resolve(cwd, trimmed);
  if (!existsSync(path)) throw new CliInputError("Block file not found: " + trimmed);
  try { if (!statSync(path).isFile()) throw new Error("not a file"); }
  catch { throw new CliInputError("Block reference is not a readable file: " + trimmed); }
  return path;
}


function resolveParentTokenToHash(token, opts = {}) {
  const trimmed = String(token ?? "").trim();
  if (trimmed === "@parent" && !opts.validateSeal) {
    const block = JSON.parse(readFileSync(resolveBlockReferenceToPath("@last", opts), "utf-8"));
    const parents = Array.isArray(block.parentHashes) ? block.parentHashes : [];
    if (parents.length === 0) throw new CliInputError("Last Block has no parentHashes; @parent is undefined.");
    if (parents.length > 1) throw new CliInputError("Last Block has multiple parents; use an explicit hash or file.");
    return String(parents[0]).toLowerCase();
  }
  if (HASH_RE.test(trimmed) && !opts.validateSeal) return trimmed.toLowerCase();
  return readParentBlockHash(resolveBlockReferenceToPath(trimmed, opts), opts);
}

export function resolveParentTokensToHashes(tokens, opts = {}) {
  return tokens.filter(Boolean).map((token) => resolveParentTokenToHash(token, opts));
}
