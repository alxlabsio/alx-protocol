/**
 * ALX Protocol HTTP API Server
 *
 * Minimal HTTP server using only Node.js built-ins.
 * Exposes the reference implementation over a JSON API.
 *
 * Usage:
 *   import { startServer } from "./server.js";
 *   const server = startServer(3000);
 */

import http from "node:http";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readProtocolVersion } from "../lib/protocol-version.js";
import sdk from "../lib/sdk.js";
import { runTestVectors } from "../lib/test-vectors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALX_CLI_VERSION = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8")).version;
const PROTOCOL_VERSION = readProtocolVersion();
const OPENAPI_PATH = resolve(__dirname, "../openapi.yaml");

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Maximum request body size (10 MB). */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/**
 * Read the full request body as a string.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * Send a JSON response with the given status code.
 */
function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

/**
 * Parse a JSON request body, returning the parsed value or sending a 400.
 * Returns undefined if parsing fails (response already sent).
 */
async function parseJsonBody(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    const status = err.message === "Request body too large" ? 413 : 400;
    sendJson(res, status, { error: err.message || "Failed to read request body" });
    return undefined;
  }

  if (!raw.trim()) {
    sendJson(res, 400, { error: "Request body is empty" });
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON in request body" });
    return undefined;
  }
}

function createLib() {
  const {
    canonicalizeProtocolJson,
    createBlock,
    validateBlock,
    deriveBlockHash,
    deriveContentHash,
    normalizeHash,
    traceAttribution,
  } = sdk;

  return {
    canonicalizeProtocolJson,
    createBlock,
    validateBlock,
    deriveBlockHash,
    deriveContentHash,
    normalizeHash,
    traceAttribution,
  };
}

// ── Route handlers ──────────────────────────────────────────────────────────

function handleHealth(_req, res, lib) {
  // Verify SDK is functional by hashing a known value through the reference implementation
  let sdkStatus = "ok";
  try {
    const hash = lib.deriveContentHash(null);
    if (!/^0x[a-f0-9]{64}$/.test(hash)) sdkStatus = "degraded";
  } catch {
    sdkStatus = "degraded";
  }

  sendJson(res, 200, {
    status: sdkStatus === "ok" ? "ok" : "degraded",
    sdk: sdkStatus,
    implementation: "typescript-reference",
    protocolVersion: PROTOCOL_VERSION,
  });
}

function handleVersion(_req, res) {
  sendJson(res, 200, {
    cli: ALX_CLI_VERSION,
    protocol: PROTOCOL_VERSION,
  });
}

async function handleBlockCreate(req, res, lib) {
  const body = await parseJsonBody(req, res);
  if (body === undefined) return;

  if (body.content === undefined) {
    sendJson(res, 400, { error: "Missing required field: content" });
    return;
  }

  const parentHashes = Array.isArray(body.parentHashes) ? body.parentHashes : [];

  try {
    const block = lib.createBlock(body.content, parentHashes);
    sendJson(res, 200, block);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleBlockValidate(req, res, lib) {
  const body = await parseJsonBody(req, res);
  if (body === undefined) return;

  if (!body.blockHash || body.content === undefined) {
    sendJson(res, 400, { error: "Input must be a Block object with blockHash, content, and parentHashes" });
    return;
  }

  try {
    const result = lib.validateBlock(body);
    sendJson(res, 200, {
      valid: result.ok,
      blockHash: result.actual,
      expectedHash: result.expected,
      ...result,
    });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleTrace(req, res, lib) {
  const body = await parseJsonBody(req, res);
  if (body === undefined) return;

  if (!body.root) {
    sendJson(res, 400, { error: "Missing required field: root" });
    return;
  }

  if (!body.graph || typeof body.graph !== "object") {
    sendJson(res, 400, { error: "Missing required field: graph (object mapping hashes to parent arrays)" });
    return;
  }

  try {
    const graph = new Map(
      Object.entries(body.graph).map(([k, v]) => [k, Array.isArray(v) ? v : []])
    );
    const trace = lib.traceAttribution(body.root, graph);
    sendJson(res, 200, trace);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

function handleTestVectors(_req, res, lib) {
  try {
    const results = runTestVectors(lib);
    sendJson(res, 200, results);
  } catch (err) {
    sendJson(res, 500, { error: `Test vector execution failed: ${err.message}` });
  }
}

// ── Server ──────────────────────────────────────────────────────────────────

/**
 * Start the ALX Protocol HTTP API server.
 *
 * @param {number} port - Port to listen on.
 * @returns {Promise<import("node:http").Server>} The running HTTP server instance.
 */
export async function startServer(port) {
  const lib = createLib();

  const server = http.createServer(async (req, res) => {
    const startMs = Date.now();

    // Structured request logging
    res.on("finish", () => {
      const entry = {
        ts: new Date().toISOString(),
        method: req.method,
        path: req.url,
        status: res.statusCode,
        ms: Date.now() - startMs,
      };
      process.stdout.write(JSON.stringify(entry) + "\n");
    });

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    try {
      // GET endpoints
      if (req.method === "GET" && path === "/health") {
        return handleHealth(req, res, lib);
      }

      if (req.method === "GET" && path === "/version") {
        return handleVersion(req, res);
      }

      if (req.method === "GET" && path === "/openapi.yaml") {
        try {
          const spec = readFileSync(OPENAPI_PATH, "utf-8");
          res.writeHead(200, {
            "Content-Type": "application/yaml; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(spec);
        } catch {
          sendJson(res, 404, { error: "OpenAPI spec not found" });
        }
        return;
      }

      // POST endpoints
      if (req.method === "POST" && path === "/block/create") {
        return await handleBlockCreate(req, res, lib);
      }

      if (req.method === "POST" && (path === "/block/validate" || path === "/validate")) {
        return await handleBlockValidate(req, res, lib);
      }

      if (req.method === "POST" && path === "/trace") {
        return await handleTrace(req, res, lib);
      }

      if (req.method === "POST" && path === "/test-vectors/run") {
        return handleTestVectors(req, res, lib);
      }

      // 404 for everything else
      sendJson(res, 404, { error: `Not found: ${req.method} ${path}` });
    } catch (err) {
      sendJson(res, 500, { error: `Internal server error: ${err.message}` });
    }
  });

  server.timeout = 30_000; // 30-second request timeout

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      console.log(`ALX Protocol server listening on http://localhost:${port}`);
      resolvePromise(server);
    });
  });
}
