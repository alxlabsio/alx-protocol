import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createBlock, validateBlock } from "../../dist/block.js";
import { ErrorCode } from "../../dist/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../../");

function loadJson(...segments) {
  return JSON.parse(readFileSync(resolve(root, ...segments), "utf-8"));
}

test("SDK package exposes Merkle only through the canonical entry point", () => {
  const packageJson = loadJson("sdk", "package.json");
  assert.ok(packageJson.exports["./merkle"]);
  assert.equal(packageJson.exports["./extensions"], undefined);
});

test("Block schema permits only the optional v1 protocolVersion", () => {
  const schema = loadJson("protocol", "schemas", "block.schema.json");
  assert.deepEqual(schema.properties.protocolVersion, {
    type: "string",
    const: "1",
    description: "Protocol algorithm version. Optional in v1, treated as version 1 when absent, and excluded from Block hash derivation.",
  });
  assert.equal(schema.required.includes("protocolVersion"), false);
});

test("canonical error catalog includes the SDK unsupported-version error", () => {
  const catalog = loadJson("protocol", "error-codes.json");
  const entry = catalog.codes.find(({ code }) => code === ErrorCode.UNSUPPORTED_VERSION);
  assert.deepEqual(entry, {
    id: "ERR-116",
    code: "ALX_UNSUPPORTED_VERSION",
    category: "version",
    severity: "fatal",
  });
});

test("validateBlock exposes structured identity comparisons and compatibility fields", () => {
  const block = createBlock("security analysis", []);
  const result = validateBlock(block);

  assert.equal(result.ok, true);
  assert.deepEqual(result.blockHash, {
    stored: block.blockHash,
    recomputed: block.blockHash,
    match: true,
  });
  assert.deepEqual(result.contentHash, {
    stored: block.contentHash,
    recomputed: block.contentHash,
    match: true,
  });
  assert.equal(result.expected, result.blockHash.recomputed);
  assert.equal(result.actual, result.blockHash.stored);
  assert.equal(result.expectedContentHash, result.contentHash.recomputed);
  assert.equal(result.actualContentHash, result.contentHash.stored);
});

test("validateBlock preserves canonical checks in structured results", () => {
  const parent = `0x${"a".repeat(64)}`;
  const block = createBlock("compliance review", [parent]);
  block.parentHashes = [];
  block.contentHash = `0x${"f".repeat(64)}`;

  const result = validateBlock(block);

  assert.equal(result.ok, false);
  assert.equal(result.blockHash.match, false);
  assert.equal(result.contentHash.match, false);
  assert.equal(result.parentsCanonical, true);
  assert.equal(result.selfRef, false);
});
