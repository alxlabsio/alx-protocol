/**
 * Informative workflow helpers: block linking (parentHashes) and blockset manifests.
 * Does not define protocol behavior.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveSetId } from "./anchor.js";
import { validateBlockset, BLOCKSET_MIN_SIZE } from "./registry-block.js";

const HASH_RE = /^0x[a-f0-9]{64}$/;

/**
 * @param {string} raw - Comma-separated blockHashes or file paths (paths not supported here)
 * @returns {string[]}
 */
export function parseCommaSeparatedBlockHashes(raw) {
  return String(raw)
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string[]} blockHashes
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validateBlocksetHashes(blockHashes) {
  return validateBlockset(blockHashes);
}

/**
 * @param {string} parentPath
 * @param {{ validateSeal?: (block: object) => { ok: boolean } }} [opts]
 * @returns {string} blockHash
 */
export function readParentBlockHash(parentPath, opts = {}) {
  const abs = resolve(parentPath);
  if (!existsSync(abs)) {
    throw new Error(`Parent Block file not found: ${parentPath}`);
  }
  let block;
  try {
    block = JSON.parse(readFileSync(abs, "utf-8"));
  } catch {
    throw new Error(`Invalid JSON in parent Block file: ${parentPath}`);
  }
  if (!block?.blockHash || !HASH_RE.test(String(block.blockHash).toLowerCase())) {
    throw new Error(`Parent file missing valid blockHash: ${parentPath}`);
  }
  if (opts.validateSeal) {
    const seal = opts.validateSeal(block);
    if (!seal.ok) {
      throw new Error(`Parent Block seal is broken: ${parentPath}`);
    }
  }
  return String(block.blockHash).toLowerCase();
}

/**
 * @param {string[]} parentPaths
 * @param {{ validateSeal?: (block: object) => { ok: boolean } }} [opts]
 * @returns {string[]}
 */
export function resolveParentHashesFromFiles(parentPaths, opts = {}) {
  const hashes = [];
  for (const p of parentPaths) {
    hashes.push(readParentBlockHash(p, opts));
  }
  return hashes;
}

/**
 * @param {object[]} graph
 * @param {string[]} blockHashes
 * @returns {{ ok: boolean, issues: string[], members: string[] }}
 */
export function selectBlocksetFromGraph(graph, blockHashes) {
  const issues = [];
  if (!Array.isArray(graph)) {
    return { ok: false, issues: ["graph must be a JSON array of Blocks"], members: [] };
  }
  const inGraph = new Set(
    graph
      .filter((b) => b?.blockHash && HASH_RE.test(String(b.blockHash).toLowerCase()))
      .map((b) => String(b.blockHash).toLowerCase()),
  );
  const members = [];
  for (const [i, h] of blockHashes.entries()) {
    const norm = String(h).trim().toLowerCase();
    if (!HASH_RE.test(norm)) {
      issues.push(`blockHashes[${i}] must be 0x-prefixed 64 hex chars`);
      continue;
    }
    if (!inGraph.has(norm)) {
      issues.push(`blockHash not found in graph: ${norm.slice(0, 18)}...`);
      continue;
    }
    members.push(norm);
  }
  const unique = [...new Set(members)];
  if (unique.length < BLOCKSET_MIN_SIZE) {
    issues.push(`blockset requires at least ${BLOCKSET_MIN_SIZE} hashes present in graph`);
  }
  return { ok: issues.length === 0, issues, members: unique };
}

/**
 * @param {{ blockHashes: string[], label?: string, setId?: string }} params
 * @returns {{ version: string, label: string|null, setId: string, blockHashes: string[] }}
 */
export function buildBlocksetManifest({ blockHashes, label, setId }) {
  const normalized = [...new Set(blockHashes.map((h) => String(h).trim().toLowerCase()))].sort();
  const check = validateBlockset(normalized);
  if (!check.ok) {
    throw new Error(check.issues.join("; "));
  }
  return {
    version: "1",
    label: label ?? null,
    setId: setId ?? deriveSetId(normalized),
    blockHashes: normalized,
  };
}

/**
 * @param {string} outPath
 * @param {object} manifest
 */
export function writeBlocksetManifest(outPath, manifest) {
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
}
