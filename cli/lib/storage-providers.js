/**
 * Storage provider adapters for ALX Protocol CLI.
 *
 * Each adapter fetches a remote object and returns a normalized
 * content object suitable for locking into a Block.
 *
 * Supported providers:
 *   IPFS  — fetch via gateway or local Kubo node
 *   S3    — fetch via AWS S3 / R2 / MinIO (no SDK dep, uses presigned-style HEAD + GET)
 *   URL   — generic HTTP/HTTPS fetch
 */

import { createHash } from "node:crypto";

const DEFAULT_TIMEOUT_MS = Number(process.env.ALX_FETCH_TIMEOUT_MS ?? 10_000);

// ── Shared fetch helper ────────────────────────────────────────────────────

async function fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBytes(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buf = await res.arrayBuffer();
  return { bytes: Buffer.from(buf), contentType: res.headers.get("content-type") ?? "" };
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function guessMimeType(contentTypeHeader, name = "") {
  if (contentTypeHeader && !contentTypeHeader.startsWith("application/octet-stream")) {
    return contentTypeHeader.split(";")[0].trim();
  }
  const ext = name.split(".").pop()?.toLowerCase();
  const map = {
    pdf: "application/pdf",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext] ?? "application/octet-stream";
}

// ── IPFS ───────────────────────────────────────────────────────────────────

/**
 * Fetch a CID via IPFS gateway and return a normalized content object.
 *
 * @param {string} cid
 * @param {{ gateway?: string, name?: string }} [opts]
 * @returns {Promise<object>}
 */
export async function fetchFromIpfs(cid, opts = {}) {
  const gateway = (opts.gateway ?? process.env.ALX_IPFS_GATEWAY ?? "https://ipfs.io/ipfs")
    .replace(/\/$/, "");
  const url = `${gateway}/${cid}`;
  const { bytes, contentType } = await fetchBytes(url);
  const name = opts.name ?? cid.slice(0, 12);

  return {
    type: "ai.artifact",
    cid,
    gatewayUrl: url,
    mimeType: guessMimeType(contentType, name),
    name,
    size: bytes.length,
    sha256: sha256Hex(bytes),
    fetchedAt: new Date().toISOString(),
  };
}

// ── S3-compatible ──────────────────────────────────────────────────────────

/**
 * Fetch object metadata from an S3-compatible store and return a normalized
 * content object. Uses unsigned HEAD + GET — call from trusted environments only.
 *
 * For production use, generate a presigned URL and pass via --from-url instead.
 *
 * @param {string} s3Uri  e.g. "s3://my-bucket/path/to/file.pdf"
 * @param {{ endpoint?: string, region?: string }} [opts]
 * @returns {Promise<object>}
 */
export async function fetchFromS3(s3Uri, opts = {}) {
  const match = s3Uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid S3 URI: ${s3Uri} — expected s3://bucket/key`);
  const [, bucket, key] = match;

  const region = opts.region ?? process.env.ALX_S3_REGION ?? "us-east-1";
  const customEndpoint = opts.endpoint ?? process.env.ALX_S3_ENDPOINT;

  const baseUrl = customEndpoint
    ? `${customEndpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  const { bytes, contentType } = await fetchBytes(baseUrl);
  const name = key.split("/").pop() ?? key;

  return {
    type: "ai.artifact",
    bucket,
    key,
    region,
    mimeType: guessMimeType(contentType, name),
    name,
    size: bytes.length,
    sha256: sha256Hex(bytes),
    fetchedAt: new Date().toISOString(),
  };
}

// ── Generic URL ────────────────────────────────────────────────────────────

/**
 * Fetch any HTTP/HTTPS URL and return a normalized content object.
 *
 * @param {string} url
 * @param {{ name?: string }} [opts]
 * @returns {Promise<object>}
 */
export async function fetchFromUrl(url, opts = {}) {
  const { bytes, contentType } = await fetchBytes(url);
  const name = opts.name ?? url.split("/").pop()?.split("?")[0] ?? "resource";

  return {
    type: "ai.artifact",
    url,
    mimeType: guessMimeType(contentType, name),
    name,
    size: bytes.length,
    sha256: sha256Hex(bytes),
    fetchedAt: new Date().toISOString(),
  };
}

// ── Env check helpers (used by alx doctor) ─────────────────────────────────

export function s3EnvStatus() {
  return {
    bucket: process.env.ALX_S3_BUCKET ?? null,
    region: process.env.ALX_S3_REGION ?? null,
    accessKeyId: process.env.ALX_S3_ACCESS_KEY_ID ? "set" : null,
    secretAccessKey: process.env.ALX_S3_SECRET_ACCESS_KEY ? "set" : null,
    endpoint: process.env.ALX_S3_ENDPOINT ?? null,
  };
}

export function ipfsEnvStatus() {
  return {
    endpoint: process.env.ALX_IPFS_ENDPOINT ?? "http://localhost:5001",
    gateway: process.env.ALX_IPFS_GATEWAY ?? "https://ipfs.io/ipfs",
  };
}

export function retrievalEnvStatus() {
  return {
    endpoint: process.env.ALX_RETRIEVAL_ENDPOINT ?? null,
    apiKey: process.env.ALX_RETRIEVAL_API_KEY ? "set" : null,
  };
}
