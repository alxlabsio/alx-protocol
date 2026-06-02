/**
 * Block resolution and IPFS publishing utilities.
 *
 * Resolution strategies (applied in order):
 *   0. Explicit CID (from opts.cid, e.g. Base pointer registry)
 *   1. Base mainnet pointer registry when opts.chain === "base"
 *   2. HTTP retrieval endpoint (GET /block/{blockHash}) when --endpoint is set
 *   3. Local registry (~/.alx/registry.json) → IPFS gateway fetch
 *
 * Publishing strategy:
 *   Kubo HTTP API (POST /api/v0/add) → stores CID in local registry
 *
 * The local registry maps blockHash → { cid, source, registeredAt }.
 * It persists across CLI invocations and is updated by `alx publish`.
 */

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import sdk from "./sdk.js";

const { validateBlock } = sdk;

const DEFAULT_REGISTRY_PATH = join(homedir(), ".alx", "registry.json");
const DEFAULT_IPFS_GATEWAY = "https://ipfs.io/ipfs";
const FETCH_TIMEOUT_MS = 10_000;

// ── Registry ─────────────────────────────────────────────────────────────────

function resolveRegistryPath(custom) {
  return custom || DEFAULT_REGISTRY_PATH;
}

function loadRegistry(registryFilePath) {
  const rp = resolveRegistryPath(registryFilePath);
  if (!existsSync(rp)) return { version: "1", entries: {} };
  try {
    const raw = readFileSync(rp, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.entries || typeof parsed.entries !== "object") return { version: "1", entries: {} };
    return parsed;
  } catch {
    return { version: "1", entries: {} };
  }
}

function saveRegistry(registry, registryFilePath) {
  const rp = resolveRegistryPath(registryFilePath);
  mkdirSync(dirname(rp), { recursive: true });
  writeFileSync(rp, JSON.stringify(registry, null, 2) + "\n");
}

export function registerCid(blockHash, cid, source, registryFilePath) {
  const registry = loadRegistry(registryFilePath);
  registry.entries[blockHash.toLowerCase()] = {
    cid,
    source: source || "ipfs",
    registeredAt: new Date().toISOString(),
  };
  saveRegistry(registry, registryFilePath);
  return registry;
}

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolve a Block by blockHash using available sources.
 *
 * @param {string} blockHash - 0x-prefixed 64-char hex hash
 * @param {{ registry?: string, gateway?: string, endpoint?: string, chain?: string, rpcUrl?: string, cid?: string, cidSource?: string }} opts
 * @returns {Promise<{ block: object, source: string, url: string } | null>}
 */
export async function resolveBlock(blockHash, opts = {}) {
  const normalizedHash = blockHash.toLowerCase();
  const gateway = (opts.gateway || DEFAULT_IPFS_GATEWAY).replace(/\/$/, "");

  if (opts.chain === "base") {
    try {
      const { resolveBlockFromBase } = await import("./chain-resolve.js");
      const fromChain = await resolveBlockFromBase(normalizedHash, {
        rpcUrl: opts.rpcUrl,
        gateway,
        registry: opts.registry,
      });
      if (fromChain) return fromChain;
    } catch (err) {
      if (!opts.endpoint && !opts.registry) throw err;
    }
  }

  // Strategy: explicit CID (e.g. from on-chain pointer registry)
  if (opts.cid) {
    const url = `${gateway}/${opts.cid}`;
    const result = await fetchAndVerify(url, normalizedHash, opts.cidSource || "on-chain-cid");
    if (result) return result;
  }

  // Strategy 1: HTTP retrieval endpoint
  if (opts.endpoint) {
    const base = opts.endpoint.replace(/\/$/, "");
    const url = `${base}/block/${normalizedHash}`;
    const result = await fetchAndVerify(url, normalizedHash, "http-endpoint");
    if (result) return result;
  }

  // Strategy 2: registry lookup → IPFS gateway
  const registry = loadRegistry(opts.registry);
  const entry = registry.entries[normalizedHash];
  if (entry?.cid) {
    const url = `${gateway}/${entry.cid}`;
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
    data = await res.json();
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

  const validation = validateBlock(block);
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
