/**
 * Local CLI session state (.alx/state.json) — optional, non-normative.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const STATE_VERSION = 1;
export const MAX_RECENT = 20;

/**
 * @param {string} [cwd]
 */
export function stateDir(cwd = process.cwd()) {
  return resolve(cwd, ".alx");
}

/**
 * @param {string} [cwd]
 */
export function stateFilePath(cwd = process.cwd()) {
  return join(stateDir(cwd), "state.json");
}

/**
 * @param {string} [cwd]
 * @returns {{ version: number, lastBlock?: object, recent: object[] }}
 */
export function loadCliState(cwd = process.cwd()) {
  const path = stateFilePath(cwd);
  if (!existsSync(path)) {
    return { version: STATE_VERSION, recent: [] };
  }
  try {
    const state = JSON.parse(readFileSync(path, "utf-8"));
    if (!Array.isArray(state.recent)) state.recent = [];
    return state;
  } catch {
    return { version: STATE_VERSION, recent: [] };
  }
}

/**
 * @param {{ block: object, outPath: string, cwd?: string }} params
 */
export function recordBlockWrite({ block, outPath, cwd = process.cwd() }) {
  if (!outPath || !block?.blockHash) return;

  const absPath = resolve(cwd, outPath);
  const entry = {
    path: absPath,
    blockHash: String(block.blockHash).toLowerCase(),
    at: new Date().toISOString(),
  };

  const state = loadCliState(cwd);
  state.version = STATE_VERSION;
  state.lastBlock = entry;
  state.recent = [
    entry,
    ...(state.recent || []).filter((r) => r.blockHash !== entry.blockHash),
  ].slice(0, MAX_RECENT);

  mkdirSync(stateDir(cwd), { recursive: true });
  writeFileSync(stateFilePath(cwd), JSON.stringify(state, null, 2) + "\n");
}

/**
 * @param {string} [cwd]
 * @param {number} [limit]
 */
export function listRecentFromState(cwd = process.cwd(), limit = 10) {
  const state = loadCliState(cwd);
  return (state.recent || []).slice(0, limit);
}
