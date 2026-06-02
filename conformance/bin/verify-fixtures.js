#!/usr/bin/env node

import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const ajv = new Ajv2020({ strict: false, allErrors: true });
const errors = [];

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, "utf-8"));
}

function listJsonFiles(dirRel) {
  const abs = resolve(REPO_ROOT, dirRel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => name.endsWith(".json"))
    .map((name) => resolve(abs, name));
}

function registerSchema(schemaRel) {
  const abs = resolve(REPO_ROOT, schemaRel);
  const schema = readJson(abs);
  if (schema.$id && !ajv.getSchema(schema.$id)) {
    ajv.addSchema(schema, schema.$id);
  }
  return schema.$id;
}

function registerCoreSchemas() {
  for (const name of readdirSync(resolve(REPO_ROOT, "protocol/schemas"))) {
    if (name.endsWith(".schema.json")) {
      registerSchema(join("protocol/schemas", name));
    }
  }
}

function registerExtensionSchemas() {
  const extensionsRoot = resolve(REPO_ROOT, "protocol/extensions");
  for (const extId of readdirSync(extensionsRoot)) {
    const schemasDir = join(extensionsRoot, extId, "schemas");
    if (!existsSync(schemasDir)) continue;
    for (const name of readdirSync(schemasDir)) {
      if (name.endsWith(".schema.json")) {
        registerSchema(join("protocol/extensions", extId, "schemas", name));
      }
    }
  }
}

function validateFixture(schemaId, fixtureAbs, shouldPass) {
  const data = readJson(fixtureAbs);
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    errors.push(`missing compiled schema ${schemaId}`);
    return;
  }
  const ok = validate(data);
  const rel = fixtureAbs.replace(`${REPO_ROOT}\\`, "").replace(`${REPO_ROOT}/`, "");
  if (shouldPass && !ok) {
    errors.push(`valid fixture rejected: ${rel} (${validate.errors?.[0]?.message ?? "invalid"})`);
  }
  if (!shouldPass && ok) {
    errors.push(`invalid fixture accepted: ${rel}`);
  }
}

const CHECKS = [
  {
    schema: "protocol/schemas/block.schema.json",
    valid: ["protocol/fixtures/valid"],
    invalid: ["protocol/fixtures/invalid"],
  },
  {
    schema: "protocol/schemas/attribution-trace.schema.json",
    valid: ["protocol/fixtures/trace/valid"],
    invalid: ["protocol/fixtures/trace/invalid"],
  },
  {
    schema: "protocol/schemas/verification-context.schema.json",
    valid: ["protocol/fixtures/verification-context/valid"],
    invalid: ["protocol/fixtures/verification-context/invalid"],
  },
  {
    schema: "protocol/schemas/content-envelope.schema.json",
    valid: ["protocol/fixtures/content-envelope/valid"],
    invalid: ["protocol/fixtures/content-envelope/invalid"],
  },
  {
    schema: "protocol/schemas/verification-receipt.schema.json",
    valid: ["protocol/fixtures/receipt/valid"],
    invalid: ["protocol/fixtures/receipt/invalid"],
  },
  {
    schema: "protocol/extensions/signing/schemas/signed-block.schema.json",
    valid: ["protocol/extensions/signing/fixtures/valid"],
    invalid: ["protocol/extensions/signing/fixtures/invalid"],
  },
  {
    schema: "protocol/extensions/ipfs-artifact-package/schemas/ipfs-artifact-package-manifest.schema.json",
    valid: ["protocol/extensions/ipfs-artifact-package/fixtures/valid"],
    invalid: ["protocol/extensions/ipfs-artifact-package/fixtures/invalid"],
  },
];

registerCoreSchemas();
registerExtensionSchemas();

const extensionManifestId = registerSchema("protocol/schemas/extension-manifest.schema.json");
for (const extId of readdirSync(resolve(REPO_ROOT, "protocol/extensions"))) {
  const manifestPath = resolve(REPO_ROOT, "protocol/extensions", extId, "extension.json");
  if (existsSync(manifestPath)) {
    validateFixture(extensionManifestId, manifestPath, true);
  }
}

let validCount = 0;
let invalidCount = 0;

for (const check of CHECKS) {
  const schemaId = registerSchema(check.schema);
  for (const dir of check.valid) {
    for (const file of listJsonFiles(dir)) {
      validateFixture(schemaId, file, true);
      validCount++;
    }
  }
  for (const dir of check.invalid) {
    for (const file of listJsonFiles(dir)) {
      validateFixture(schemaId, file, false);
      invalidCount++;
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Fixture schema verification passed (${validCount} valid, ${invalidCount} invalid).`);
