/**
 * Block resolution and IPFS publishing utilities.
 *
 * Resolution strategies (applied in order):
 *   1. HTTP retrieval endpoint (GET /block/{blockHash}) when --endpoint is set
 *   2. Local CID map (~/.alx/cid-map.json) → IPFS gateway fetch
 *
 * Publishing strategy:
 *   Kubo HTTP API (POST /api/v0/add) → records the CID in the local CID map
 *
 * The local CID map maps blockHash → { cid, source, recordedAt }.
 * It persists across CLI invocations and is updated by `alx block publish`.
 */

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import sdk from "./sdk.js";
import { parseStrictJsonBytes } from "./strict-json.js";

const { validateBlock } = sdk;

const DEFAULT_CID_MAP_PATH = join(homedir(), ".alx", "cid-map.json");
const DEFAULT_IPFS_GATEWAY = "https://ipfs.io/ipfs";
const FETCH_TIMEOUT_MS = 10_000;

// ── Local CID map ────────────────────────────────────────────────────────────

function resolveCidMapPath(custom) {
  return custom || DEFAULT_CID_MAP_PATH;
}

function loadCidMap(cidMapFilePath) {
  const rp = resolveCidMapPath(cidMapFilePath);
  if (!existsSync(rp)) return { version: "1", mappings: {} };
  try {
    const raw = readFileSync(rp, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.mappings || typeof parsed.mappings !== "object") return { version: "1", mappings: {} };
    return parsed;
  } catch {
    return { version: "1", mappings: {} };
  }
}

function saveCidMap(cidMap, cidMapFilePath) {
  const rp = resolveCidMapPath(cidMapFilePath);
  mkdirSync(dirname(rp), { recursive: true });
  writeFileSync(rp, JSON.stringify(cidMap, null, 2) + "\n");
}

export function recordCidMapping(blockHash, cid, source, cidMapFilePath) {
  const cidMap = loadCidMap(cidMapFilePath);
  cidMap.mappings[blockHash.toLowerCase()] = {
    cid,
    source: source || "ipfs",
    recordedAt: new Date().toISOString(),
  };
  saveCidMap(cidMap, cidMapFilePath);
  return cidMap;
}

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolve a Block by blockHash using available sources.
 *
 * @param {string} blockHash - 0x-prefixed 64-char hex hash
 * @param {{ cidMap?: string, gateway?: string, endpoint?: string }} opts
 * @returns {Promise<{ block: object, source: string, url: string } | null>}
 */
export async function resolveBlock(blockHash, opts = {}) {
  const normalizedHash = blockHash.toLowerCase();
  const gateway = (opts.gateway || DEFAULT_IPFS_GATEWAY).replace(/\/$/, "");

  // Strategy 1: HTTP retrieval endpoint
  if (opts.endpoint) {
    const base = opts.endpoint.replace(/\/$/, "");
    const url = `${base}/block/${normalizedHash}`;
    const result = await fetchAndVerify(url, normalizedHash, "http-endpoint");
    if (result) return result;
  }

  // Strategy 2: local CID-map lookup → IPFS gateway
  const cidMap = loadCidMap(opts.cidMap);
  const mapping = cidMap.mappings[normalizedHash];
  if (mapping?.cid) {
    const url = `${gateway}/${mapping.cid}`;
    const result = await fetchAndVerify(url, normalizedHash, "ipfs-gateway");
    if (result) return result;
  }

  return null;
}

/**
 * Publish a Block to a retrieval HTTP endpoint (POST /block).
 *
 * @param {object} block - A validated ALX Block
 * @param {string} endpoint - Base URL of the retrieval server
 * @param {{ cid?: string }} [opts]
 */
export async function publishToRetrievalEndpoint(block, endpoint, opts = {}) {
  const base = endpoint.replace(/\/$/, "");
  const body = opts.cid ? { block, cid: opts.cid } : block;
  const headers = { "Content-Type": "application/json" };
  const apiKey = opts.apiKey || process.env.ALX_RETRIEVAL_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let res;
  try {
    res = await fetch(`${base}/block`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(`Retrieval endpoint unreachable at ${base}: ${err.message}`);
  }

  if (!res.ok && res.status !== 200 && res.status !== 201) {
    const text = await res.text().catch(() => "");
    throw new Error(`Retrieval endpoint error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function fetchAndVerify(url, expectedHash, source) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data;
  try {
    data = parseStrictJsonBytes(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }

  // Retrieval API wraps in { block: ... }; IPFS gateway returns the raw object
  const block = data?.block ?? data;

  if (
    !block ||
    typeof block !== "object" ||
    typeof block.blockHash !== "string" ||
    block.blockHash.toLowerCase() !== expectedHash
  ) {
    return null;
  }

  let validation;
  try {
    validation = validateBlock(block);
  } catch {
    return null;
  }
  if (!validation.ok) {
    return null;
  }

  return { block, source, url };
}

// ── Publishing ────────────────────────────────────────────────────────────────

/**
 * Pin a Block to an IPFS node via the Kubo HTTP API.
 *
 * @param {object} block - A validated ALX Block object
 * @param {string} ipfsEndpoint - Base URL of the Kubo HTTP API (default: http://localhost:5001)
 * @returns {Promise<string>} The IPFS CID of the pinned content
 */
export async function publishToIpfs(block, ipfsEndpoint) {
  const base = (ipfsEndpoint || "http://localhost:5001").replace(/\/$/, "");
  const content = JSON.stringify(block, null, 2);

  const form = new FormData();
  form.append("file", new Blob([content], { type: "application/json" }), "block.json");

  let res;
  try {
    res = await fetch(`${base}/api/v0/add?pin=true`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(`IPFS API unreachable at ${base}: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IPFS API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  if (!result.Hash) throw new Error(`IPFS API returned unexpected response: ${JSON.stringify(result)}`);
  return result.Hash;
}
