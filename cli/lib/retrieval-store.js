/**
 * File-backed Block store for the reference retrieval HTTP server.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import sdk from "./sdk.js";

const { validateBlock } = sdk;

const HASH_PATTERN = /^0x[a-f0-9]{64}$/;

export function normalizeBlockHash(blockHash) {
  if (typeof blockHash !== "string") return null;
  const normalized = blockHash.trim().toLowerCase();
  return HASH_PATTERN.test(normalized) ? normalized : null;
}

function canonicalBlockJson(block) {
  return JSON.stringify(block);
}

function blocksDir(dataDir) {
  return join(dataDir, "blocks");
}

function cidIndexPath(dataDir) {
  return join(dataDir, "cids.json");
}

function loadCidIndex(dataDir) {
  const path = cidIndexPath(dataDir);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCidIndex(dataDir, index) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(cidIndexPath(dataDir), JSON.stringify(index, null, 2) + "\n");
}

function blockPath(dataDir, blockHash) {
  return join(blocksDir(dataDir), `${blockHash}.json`);
}

/**
 * @param {string} dataDir
 */
export function createRetrievalStore(dataDir) {
  mkdirSync(blocksDir(dataDir), { recursive: true });

  return {
    dataDir,

    hasBlock(blockHash) {
      const hash = normalizeBlockHash(blockHash);
      if (!hash) return false;
      return existsSync(blockPath(dataDir, hash));
    },

    getBlock(blockHash) {
      const hash = normalizeBlockHash(blockHash);
      if (!hash) return null;
      const path = blockPath(dataDir, hash);
      if (!existsSync(path)) return null;
      try {
        return JSON.parse(readFileSync(path, "utf-8"));
      } catch {
        return null;
      }
    },

    getCidMapping(blockHash) {
      const hash = normalizeBlockHash(blockHash);
      if (!hash) return null;
      const index = loadCidIndex(dataDir);
      const entry = index[hash];
      if (!entry?.cid) return null;
      return entry;
    },

    /**
     * @returns {{ status: "created" | "exists" | "conflict", blockHash: string, cid?: string }}
     */
    putBlock(block, cid) {
      const hash = normalizeBlockHash(block?.blockHash);
      if (!hash) {
        throw Object.assign(new Error("Invalid blockHash format"), { code: "INVALID_HASH" });
      }

      const validation = validateBlock(block);
      if (!validation.ok) {
        throw Object.assign(new Error("Block failed validation"), { code: "INVALID_BLOCK" });
      }

      const path = blockPath(dataDir, hash);
      const incoming = canonicalBlockJson(block);

      if (existsSync(path)) {
        const existing = readFileSync(path, "utf-8");
        if (existing === incoming) {
          if (cid) this.putCidMapping(hash, cid);
          return { status: "exists", blockHash: hash, cid: cid || this.getCidMapping(hash)?.cid };
        }
        throw Object.assign(new Error("Block already exists with different content"), { code: "CONFLICT" });
      }

      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, incoming);

      if (cid) this.putCidMapping(hash, cid);

      return { status: "created", blockHash: hash, cid: cid || undefined };
    },

    putCidMapping(blockHash, cid, gatewayUrl) {
      const hash = normalizeBlockHash(blockHash);
      if (!hash) {
        throw Object.assign(new Error("Invalid blockHash format"), { code: "INVALID_HASH" });
      }
      if (typeof cid !== "string" || !cid.trim()) {
        throw Object.assign(new Error("Invalid CID"), { code: "INVALID_CID" });
      }

      const index = loadCidIndex(dataDir);
      index[hash] = {
        cid: cid.trim(),
        ...(gatewayUrl ? { gatewayUrl } : {}),
      };
      saveCidIndex(dataDir, index);
      return index[hash];
    },

    getBlocks(blockHashes) {
      const blocks = [];
      const missing = [];

      for (const raw of blockHashes) {
        const hash = normalizeBlockHash(raw);
        if (!hash) {
          missing.push(raw);
          continue;
        }
        const block = this.getBlock(hash);
        if (block) blocks.push(block);
        else missing.push(hash);
      }

      return { blocks, missing };
    },
  };
}
