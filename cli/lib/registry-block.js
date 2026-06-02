/**
 * Informative helpers for off-chain convention Blocks:
 *   alx.registry — steward / platform catalog
 *   alx.index    — platform index of available or approved blockHashes (trust inclusion)
 */

const REGISTRY_TYPE = "alx.registry";
const INDEX_TYPE = "alx.index";
const HASH_RE = /^0x[a-f0-9]{64}$/;
const INDEX_STATUSES = new Set(["available", "approved", "published", "withdrawn"]);

function validateIssuerEnvelope(content, expectedType, issues) {
  if (!content || typeof content !== "object") {
    issues.push("content must be an object");
    return;
  }
  if (content.type !== expectedType) {
    issues.push(`content.type should be "${expectedType}"`);
  }
  if (typeof content.version !== "string") {
    issues.push("content.version is required (string)");
  }
  if (typeof content.issuer !== "string" || !content.issuer.trim()) {
    issues.push("content.issuer is required (e.g. xandrlabs, acme-corp)");
  }
  if (!Array.isArray(content.entries)) {
    issues.push("content.entries must be an array");
  }
}

function validateRegistryEntries(entries, issues) {
  for (const [i, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object") {
      issues.push(`entries[${i}] must be an object`);
      continue;
    }
    if (!entry.role) issues.push(`entries[${i}].role is required`);
    if (entry.blockHash && !HASH_RE.test(String(entry.blockHash).toLowerCase())) {
      issues.push(`entries[${i}].blockHash must be 0x-prefixed 64 hex chars`);
    }
  }
}

function validateIndexEntries(entries, issues) {
  for (const [i, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object") {
      issues.push(`entries[${i}] must be an object`);
      continue;
    }
    if (!entry.blockHash || !HASH_RE.test(String(entry.blockHash).toLowerCase())) {
      issues.push(`entries[${i}].blockHash is required (0x + 64 hex)`);
    }
    if (entry.status && !INDEX_STATUSES.has(entry.status)) {
      issues.push(
        `entries[${i}].status must be one of: ${[...INDEX_STATUSES].join(", ")}`,
      );
    }
  }
}

/**
 * @param {object} content - Block.content
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validateRegistryBlockContent(content) {
  const issues = [];
  validateIssuerEnvelope(content, REGISTRY_TYPE, issues);
  if (Array.isArray(content?.entries)) validateRegistryEntries(content.entries, issues);
  return { ok: issues.length === 0, issues };
}

/**
 * @param {object} content - Block.content
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validateIndexBlockContent(content) {
  const issues = [];
  validateIssuerEnvelope(content, INDEX_TYPE, issues);
  if (Array.isArray(content?.entries)) validateIndexEntries(content.entries, issues);
  return { ok: issues.length === 0, issues };
}

/**
 * @param {string} blockHash
 * @param {object} indexContent - validated alx.index content
 * @param {{ approvedOnly?: boolean }} [opts]
 * @returns {boolean}
 */
export function isBlockHashInIndex(blockHash, indexContent, opts = {}) {
  const normalized = String(blockHash).trim().toLowerCase();
  if (!HASH_RE.test(normalized) || !indexContent?.entries) return false;
  const approvedOnly = opts.approvedOnly === true;
  return indexContent.entries.some((entry) => {
    if (String(entry.blockHash).toLowerCase() !== normalized) return false;
    if (!approvedOnly) return true;
    return entry.status === "approved" || entry.status === "published";
  });
}

/**
 * Build registry Block content (caller passes parentHashes to createBlock separately).
 *
 * @param {string} issuer
 * @param {object[]} entries
 */
export function buildRegistryBlockContent(issuer, entries) {
  return {
    type: REGISTRY_TYPE,
    version: "1",
    issuer,
    entries,
  };
}

/**
 * @param {string} issuer - platform id
 * @param {object[]} entries - each requires blockHash; optional status, cid, label
 */
export function buildIndexBlockContent(issuer, entries) {
  return {
    type: INDEX_TYPE,
    version: "1",
    issuer,
    entries,
  };
}

export { REGISTRY_TYPE, INDEX_TYPE };

/** Minimum blockHashes in an ALX blockset (informative convention). */
export const BLOCKSET_MIN_SIZE = 2;

/**
 * @param {string[]} blockHashes
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validateBlockset(blockHashes) {
  const issues = [];
  if (!Array.isArray(blockHashes)) {
    return { ok: false, issues: ["blockHashes must be an array"] };
  }
  if (blockHashes.length < BLOCKSET_MIN_SIZE) {
    issues.push(`blockset requires at least ${BLOCKSET_MIN_SIZE} blockHashes`);
  }
  for (const [i, h] of blockHashes.entries()) {
    if (!HASH_RE.test(String(h).trim().toLowerCase())) {
      issues.push(`blockHashes[${i}] must be 0x-prefixed 64 hex chars`);
    }
  }
  return { ok: issues.length === 0, issues };
}
