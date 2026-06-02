/**
 * ALX Protocol Block Retrieval API (reference implementation).
 *
 * Implements protocol/retrieval-api.yaml over Node.js built-ins.
 *
 * Usage:
 *   import { startRetrievalServer } from "./retrieval-server.js";
 *   await startRetrievalServer(8081, { dataDir: "./.alx-retrieval" });
 */

import http from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRetrievalStore, normalizeBlockHash } from "../lib/retrieval-store.js";
import {
  loadRetrievalGuardConfig,
  createRateLimiter,
  clientIp,
  isWriteAuthorized,
  isMutationMethod,
} from "../lib/retrieval-guard.js";
import { REPO_ROOT } from "../lib/repo-root.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RETRIEVAL_OPENAPI_PATH = resolve(REPO_ROOT, "protocol/retrieval-api.yaml");

const MAX_BODY_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_BLOCKS = 256;

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
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
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-ALX-API-Key",
  });
  res.end(body);
}

function sendEmpty(res, status) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-ALX-API-Key",
  });
  res.end();
}

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

/**
 * Accept either a raw Block or reference envelope { block, cid? }.
 */
function parsePublishBody(body) {
  if (!body || typeof body !== "object") return null;

  if (body.block && typeof body.block === "object") {
    return {
      block: body.block,
      cid: typeof body.cid === "string" ? body.cid : undefined,
    };
  }

  if (body.blockHash && body.content !== undefined) {
    return { block: body, cid: typeof body.cid === "string" ? body.cid : undefined };
  }

  return null;
}

function gatewayUrlFor(store, blockHash, defaultGateway) {
  const mapping = store.getCidMapping(blockHash);
  if (!mapping) return undefined;
  if (mapping.gatewayUrl) return mapping.gatewayUrl;
  if (defaultGateway && mapping.cid) {
    return `${defaultGateway.replace(/\/$/, "")}/${mapping.cid}`;
  }
  return undefined;
}

function createHandlers(store, defaultGateway) {
  function handleGetBlock(blockHash, res, includeBody) {
    const hash = normalizeBlockHash(blockHash);
    if (!hash) {
      if (includeBody) {
        sendJson(res, 400, { error: "Invalid blockHash format", blockHash });
      } else {
        sendEmpty(res, 400);
      }
      return;
    }

    const block = store.getBlock(hash);
    if (!block) {
      if (includeBody) {
        sendJson(res, 404, { error: "Block not found", blockHash: hash });
      } else {
        sendEmpty(res, 404);
      }
      return;
    }

    if (!includeBody) {
      sendEmpty(res, 200);
      return;
    }

    const cidMapping = store.getCidMapping(hash);
    sendJson(res, 200, {
      block,
      ...(cidMapping?.cid ? { cid: cidMapping.cid } : {}),
      source: "local",
    });
  }

  return {
    handleHealth(_req, res) {
      sendJson(res, 200, { status: "ok" });
    },

    handleOpenApi(_req, res) {
      try {
        const spec = readFileSync(RETRIEVAL_OPENAPI_PATH, "utf-8");
        res.writeHead(200, {
          "Content-Type": "application/yaml; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(spec);
      } catch {
        sendJson(res, 404, { error: "OpenAPI spec not found" });
      }
    },

    handleGetBlock(req, res, blockHash) {
      handleGetBlock(blockHash, res, true);
    },

    handleHeadBlock(_req, res, blockHash) {
      handleGetBlock(blockHash, res, false);
    },

    handleGetCid(_req, res, blockHash) {
      const hash = normalizeBlockHash(blockHash);
      if (!hash) {
        sendJson(res, 400, { error: "Invalid blockHash format", blockHash });
        return;
      }

      const mapping = store.getCidMapping(hash);
      if (!mapping?.cid) {
        sendJson(res, 404, { error: "CID not found for Block", blockHash: hash });
        return;
      }

      const gatewayUrl = gatewayUrlFor(store, hash, defaultGateway);
      sendJson(res, 200, {
        blockHash: hash,
        cid: mapping.cid,
        ...(gatewayUrl ? { gatewayUrl } : {}),
      });
    },

    async handlePublishBlock(req, res) {
      const body = await parseJsonBody(req, res);
      if (body === undefined) return;

      const parsed = parsePublishBody(body);
      if (!parsed) {
        sendJson(res, 400, { error: "Request body must be a Block or { block, cid? }" });
        return;
      }

      try {
        const result = store.putBlock(parsed.block, parsed.cid);
        const status = result.status === "created" ? 201 : 200;
        sendJson(res, status, {
          blockHash: result.blockHash,
          ...(result.cid ? { cid: result.cid } : {}),
        });
      } catch (err) {
        if (err.code === "INVALID_BLOCK") {
          sendJson(res, 400, { error: "Block failed validation" });
          return;
        }
        if (err.code === "INVALID_HASH") {
          sendJson(res, 400, { error: "Invalid blockHash format" });
          return;
        }
        if (err.code === "CONFLICT") {
          sendJson(res, 409, {
            error: "Block already exists with different content",
            blockHash: normalizeBlockHash(parsed.block.blockHash),
          });
          return;
        }
        sendJson(res, 500, { error: err.message || "Failed to store Block" });
      }
    },

    async handleBatchBlocks(req, res) {
      const body = await parseJsonBody(req, res);
      if (body === undefined) return;

      if (!Array.isArray(body.blockHashes) || body.blockHashes.length === 0) {
        sendJson(res, 400, { error: "Missing required field: blockHashes (non-empty array)" });
        return;
      }

      if (body.blockHashes.length > MAX_BATCH_BLOCKS) {
        sendJson(res, 400, { error: `blockHashes exceeds maximum of ${MAX_BATCH_BLOCKS}` });
        return;
      }

      const { blocks, missing } = store.getBlocks(body.blockHashes);
      sendJson(res, 200, { blocks, missing });
    },
  };
}

/**
 * Match /block/{blockHash} or /block/{blockHash}/cid
 */
function parseBlockPath(pathname) {
  const match = pathname.match(/^\/block\/(0x[a-f0-9]{64})(?:\/cid)?$/i);
  if (!match) return null;
  return {
    blockHash: match[1].toLowerCase(),
    wantsCid: pathname.endsWith("/cid"),
  };
}

/**
 * @param {number} port
 * @param {{ dataDir?: string, gateway?: string }} [options]
 */
export async function startRetrievalServer(port, options = {}) {
  const dataDir = options.dataDir || resolve(process.cwd(), ".alx-retrieval");
  const defaultGateway = options.gateway || "https://ipfs.io/ipfs";
  const guardConfig = loadRetrievalGuardConfig(options.env);
  const rateLimiter = createRateLimiter(guardConfig);
  const store = createRetrievalStore(dataDir);
  const handlers = createHandlers(store, defaultGateway);

  const server = http.createServer(async (req, res) => {
    const startMs = Date.now();

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

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-ALX-API-Key",
      });
      res.end();
      return;
    }

    const ip = clientIp(req);
    if (isMutationMethod(req.method) && !rateLimiter(ip)) {
      sendJson(res, 429, { error: "Rate limit exceeded" });
      return;
    }

    if (isMutationMethod(req.method) && !isWriteAuthorized(req, guardConfig.apiKey)) {
      sendJson(res, 401, { error: "Unauthorized — write operations require API key" });
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    try {
      if (req.method === "GET" && path === "/health") {
        return handlers.handleHealth(req, res);
      }

      if (req.method === "GET" && path === "/openapi.yaml") {
        return handlers.handleOpenApi(req, res);
      }

      if (req.method === "POST" && path === "/block") {
        return await handlers.handlePublishBlock(req, res);
      }

      if (req.method === "POST" && path === "/blocks") {
        return await handlers.handleBatchBlocks(req, res);
      }

      if (path.startsWith("/block/") && path !== "/block") {
        const blockPath = parseBlockPath(path);
        if (!blockPath) {
          sendJson(res, 400, { error: "Invalid blockHash format" });
          return;
        }
        if (req.method === "GET" && blockPath.wantsCid) {
          return handlers.handleGetCid(req, res, blockPath.blockHash);
        }
        if (req.method === "GET") {
          return handlers.handleGetBlock(req, res, blockPath.blockHash);
        }
        if (req.method === "HEAD" && !blockPath.wantsCid) {
          return handlers.handleHeadBlock(req, res, blockPath.blockHash);
        }
      }

      sendJson(res, 404, { error: `Not found: ${req.method} ${path}` });
    } catch (err) {
      sendJson(res, 500, { error: `Internal server error: ${err.message}` });
    }
  });

  server.timeout = 30_000;

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      process.stdout.write(`ALX retrieval server listening on http://localhost:${port}\n`);
      process.stdout.write(`Data directory: ${dataDir}\n`);
      if (guardConfig.apiKey) {
        process.stdout.write(`Write auth:   enabled (ALX_RETRIEVAL_API_KEY)\n`);
      }
      process.stdout.write(
        `Rate limit:   ${guardConfig.maxRequests} requests / ${guardConfig.windowMs}ms per client\n`,
      );
      resolvePromise(server);
    });
  });
}

export { createRetrievalStore };
