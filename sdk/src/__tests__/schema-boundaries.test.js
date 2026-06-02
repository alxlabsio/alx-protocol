import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../../../");

function loadJson(...segments) {
  return JSON.parse(readFileSync(resolve(root, ...segments), "utf-8"));
}

test("core Block schema excludes signing metadata and enforces MAX_PARENTS", () => {
  const schema = loadJson("protocol", "schemas", "block.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.equal("attestation" in schema.properties, false);
  assert.equal("attestations" in schema.properties, false);
  assert.equal(schema.properties.parentHashes.$ref, "./defs.schema.json#/$defs/parentHashes");
});

test("signing extension schema wraps core Block and owns signing metadata", () => {
  const schema = loadJson("protocol", "extensions", "signing", "schemas", "signed-block.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.block.$ref, "../../../schemas/block.schema.json");
  assert.ok(schema.properties.attestation);
  assert.ok(schema.properties.attestations);
});

test("signing fixture remains outside the core Block boundary", () => {
  const fixture = loadJson("protocol", "extensions", "signing", "fixtures", "valid", "signed-block-multi-attestation.json");
  assert.ok(fixture.block);
  assert.ok("attestation" in fixture);
  assert.ok("attestations" in fixture);

  const coreSchema = loadJson("protocol", "schemas", "block.schema.json");
  const allowedCoreKeys = new Set(Object.keys(coreSchema.properties));
  const extensionOnlyKeys = Object.keys(fixture).filter((key) => !allowedCoreKeys.has(key));
  assert.deepEqual(extensionOnlyKeys.sort(), ["attestation", "attestations", "block"]);
});

test("Trace schema rejects exact duplicate nodes, edges, and leaves structurally", () => {
  const schema = loadJson("protocol", "schemas", "attribution-trace.schema.json");
  assert.equal(schema.properties.nodes.uniqueItems, true);
  assert.equal(schema.properties.edges.uniqueItems, true);
  assert.equal(schema.properties.leaves.uniqueItems, true);
});

test("shared schema definitions centralize hash, parentHashes, and attestation structure", () => {
  const defs = loadJson("protocol", "schemas", "defs.schema.json");
  assert.equal(defs.$defs.hash.pattern, "^0x[a-f0-9]{64}$");
  assert.equal(defs.$defs.parentHashes.maxItems, 256);
  assert.ok(defs.$defs.attestation);
});
