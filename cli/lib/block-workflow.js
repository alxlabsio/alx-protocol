/**
 * Informative workflow helpers for Block parent linking and anchor input parsing.
 * Does not define protocol behavior.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseStrictJsonBytes } from "./strict-json.js";

const HASH_RE = /^0x[a-f0-9]{64}$/;


/** Validate the hash batch accepted by the optional anchor contract. */
export function validateBlockHashBatch(blockHashes) {
  const issues = [];
  if (!Array.isArray(blockHashes)) {
    return { ok: false, issues: ["blockHashes must be an array"] };
  }
  if (blockHashes.length < 2) {
    issues.push("anchor batch requires at least 2 blockHashes");
  }
  for (const [index, blockHash] of blockHashes.entries()) {
    if (!HASH_RE.test(String(blockHash).trim().toLowerCase())) {
      issues.push(`blockHashes[${index}] must be 0x-prefixed 64 hex chars`);
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Read and optionally validate one parent Block file. */
export function readParentBlockHash(parentPath, opts = {}) {
  const absolute = resolve(parentPath);
  if (!existsSync(absolute)) {
    throw new Error(`Parent Block file not found: ${parentPath}`);
  }
  let block;
  try {
    block = parseStrictJsonBytes(readFileSync(absolute));
  } catch {
    throw new Error(`Invalid JSON in parent Block file: ${parentPath}`);
  }
  if (!block?.blockHash || !HASH_RE.test(String(block.blockHash).toLowerCase())) {
    throw new Error(`Parent file missing valid blockHash: ${parentPath}`);
  }
  if (opts.validateSeal && !opts.validateSeal(block).ok) {
    throw new Error(`Parent Block seal is broken: ${parentPath}`);
  }
  return String(block.blockHash).toLowerCase();
}
