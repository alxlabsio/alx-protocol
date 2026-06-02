/**
 * Resolve parent references for block link/create: files, hashes, @latest, @parent.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { CliInputError } from "./cli-args.js";
import { loadCliState, listRecentFromState } from "./cli-state.js";
import { readParentBlockHash, resolveParentHashesFromFiles } from "./block-workflow.js";

const HASH_RE = /^0x[a-f0-9]{64}$/;
const HASH_PREFIX_RE = /^0x[a-f0-9]{4,64}$/i;

/**
 * @param {string} [cwd]
 * @returns {string[]} absolute paths to *.block.json in cwd (non-recursive)
 */
export function findBlockJsonFilesInCwd(cwd = process.cwd()) {
  const dir = resolve(cwd);
  if (!existsSync(dir)) return [];

  const files = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".block.json")) continue;
    const full = resolve(dir, name);
    try {
      if (statSync(full).isFile()) files.push(full);
    } catch {
      // skip
    }
  }
  return files.sort();
}

/**
 * @param {string} cwd
 * @param {string} hashOrPrefix
 * @returns {string|null} absolute path
 */
export function findBlockFileByHash(cwd, hashOrPrefix) {
  const normalized = String(hashOrPrefix).trim().toLowerCase();
  const files = findBlockJsonFilesInCwd(cwd);
  const matches = [];

  for (const file of files) {
    let block;
    try {
      block = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      continue;
    }
    const h = String(block?.blockHash || "").toLowerCase();
    if (!h) continue;
    if (h === normalized) {
      matches.push(file);
      continue;
    }
    const needle = normalized.startsWith("0x") ? normalized.slice(2) : normalized;
    const hay = h.slice(2);
    if (needle.length >= 4 && hay.startsWith(needle)) {
      matches.push(file);
    }
  }

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new CliInputError(
      `Ambiguous blockHash prefix ${hashOrPrefix} matches ${matches.length} files: ${matches.map((f) => basename(f)).join(", ")}`,
    );
  }
  return null;
}

/**
 * @param {string} token
 * @param {{ cwd?: string, validateSeal?: (block: object) => { ok: boolean } }} [opts]
 * @returns {string} absolute path to parent Block file
 */
export function resolveParentTokenToPath(token, opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const trimmed = token.trim();

  if (trimmed === "@latest") {
    const state = loadCliState(cwd);
    if (!state.lastBlock?.path || !existsSync(state.lastBlock.path)) {
      throw new CliInputError(
        "No @latest block in .alx/state.json. Create or link a Block with --out first, or pass an explicit parent file.",
      );
    }
    return resolve(state.lastBlock.path);
  }

  if (trimmed === "@parent") {
    const state = loadCliState(cwd);
    if (!state.lastBlock?.path || !existsSync(state.lastBlock.path)) {
      throw new CliInputError("No last block for @parent. Run alx block link with --out first.");
    }
    const lastPath = resolve(state.lastBlock.path);
    let lastBlock;
    try {
      lastBlock = JSON.parse(readFileSync(lastPath, "utf-8"));
    } catch {
      throw new CliInputError(`Cannot read last block file: ${lastPath}`);
    }
    const parents = lastBlock.parentHashes || [];
    if (parents.length === 0) {
      throw new CliInputError("Last block has no parentHashes — @parent is undefined.");
    }
    if (parents.length > 1) {
      throw new CliInputError(
        `Last block has ${parents.length} parents. Use an explicit parent file or hash instead of @parent.`,
      );
    }
    return resolveParentTokenToPath(parents[0], opts);
  }

  if (HASH_PREFIX_RE.test(trimmed)) {
    const file = findBlockFileByHash(cwd, trimmed);
    if (file) return file;
    const recent = listRecentFromState(cwd, 5);
    const hints = recent.map((r) => basename(r.path)).join(", ");
    throw new CliInputError(
      `No Block file in ${cwd} for hash ${trimmed}.${hints ? ` Recent: ${hints}.` : ""} Try: alx block list --recent`,
    );
  }

  const abs = resolve(cwd, trimmed);
  if (!existsSync(abs)) {
    const nearby = findBlockJsonFilesInCwd(cwd)
      .map((f) => basename(f))
      .filter((name) => name.includes(trimmed) || trimmed.includes(name.replace(".block.json", "")))
      .slice(0, 5);
    const suggestion = nearby.length > 0 ? ` Did you mean: ${nearby.join(", ")}?` : "";
    throw new CliInputError(`Parent file not found: ${trimmed}.${suggestion}`);
  }
  return abs;
}

/**
 * @param {string[]} tokens — comma-separated tokens may already be split
 * @param {{ cwd?: string, validateSeal?: (block: object) => { ok: boolean } }} [opts]
 * @returns {string[]}
 */
export function resolveParentTokensToPaths(tokens, opts = {}) {
  const paths = [];
  for (const token of tokens) {
    if (!token) continue;
    paths.push(resolveParentTokenToPath(token, opts));
  }
  return paths;
}

/**
 * @param {string[]} tokens
 * @param {{ cwd?: string, validateSeal?: (block: object) => { ok: boolean } }} [opts]
 * @returns {string[]} blockHashes
 */
export function resolveParentTokensToHashes(tokens, opts = {}) {
  const paths = resolveParentTokensToPaths(tokens, opts);
  return resolveParentHashesFromFiles(paths, opts);
}

/**
 * Suggest block files when parent is missing.
 * @param {string} [cwd]
 * @returns {string[]}
 */
export function suggestBlockFiles(cwd = process.cwd()) {
  const fromDisk = findBlockJsonFilesInCwd(cwd).map((f) => basename(f));
  const fromState = listRecentFromState(cwd, 5).map((r) => basename(r.path));
  return [...new Set([...fromState, ...fromDisk])].slice(0, 8);
}
