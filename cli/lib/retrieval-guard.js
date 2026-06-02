/**
 * Optional rate limiting and write authentication for the reference retrieval server.
 *
 * Environment:
 *   ALX_RETRIEVAL_API_KEY — if set, POST /block and POST /blocks require
 *     Authorization: Bearer <key> or X-ALX-API-Key: <key>
 *   ALX_RETRIEVAL_RATE_LIMIT — max mutation requests per IP per window (default 120)
 *   ALX_RETRIEVAL_RATE_WINDOW_MS — window length in ms (default 60000)
 */

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;

function parsePositiveInt(value, fallback) {
  if (value == null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadRetrievalGuardConfig(env = process.env) {
  return {
    apiKey: env.ALX_RETRIEVAL_API_KEY?.trim() || null,
    maxRequests: parsePositiveInt(env.ALX_RETRIEVAL_RATE_LIMIT, DEFAULT_MAX_REQUESTS),
    windowMs: parsePositiveInt(env.ALX_RETRIEVAL_RATE_WINDOW_MS, DEFAULT_WINDOW_MS),
  };
}

export function createRateLimiter({ maxRequests, windowMs }) {
  /** @type {Map<string, { start: number, count: number }>} */
  const buckets = new Map();

  return function allow(clientKey) {
    const key = clientKey || "unknown";
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= maxRequests;
  };
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {string|null} configuredKey
 */
export function isWriteAuthorized(req, configuredKey) {
  if (!configuredKey) return true;

  const bearer = req.headers.authorization;
  if (typeof bearer === "string" && bearer === `Bearer ${configuredKey}`) {
    return true;
  }

  const headerKey = req.headers["x-alx-api-key"];
  if (typeof headerKey === "string" && headerKey === configuredKey) {
    return true;
  }

  return false;
}

export function isMutationMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}
