#!/usr/bin/env node

import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat("uri", {
  type: "string",
  validate: (value) => /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$/.test(value),
});
const errors = [];
const LOCAL_SCHEMA_ORIGIN = "alx-local://schemas/";

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, "utf-8"));
}

function listJsonFiles(dirRel) {
  const abs = resolve(REPO_ROOT, dirRel);
  if (!existsSync(abs)) {
    errors.push(`missing fixture directory: ${dirRel}`);
    return [];
  }
  const files = readdirSync(abs)
    .filter((name) => name.endsWith(".json"))
    .map((name) => resolve(abs, name));
  if (files.length === 0) errors.push(`empty fixture directory: ${dirRel}`);
  return files;
}

function registerSchema(schemaRel) {
  const abs = resolve(REPO_ROOT, schemaRel);
  const schema = readJson(abs);
  const normalized = schemaRel.replaceAll("\\", "/");
  const localId = new URL(normalized, LOCAL_SCHEMA_ORIGIN).href;
  if (!ajv.getSchema(localId)) {
    ajv.addSchema({ ...schema, $id: localId }, localId);
  }
  if (schema.$id && !ajv.getSchema(schema.$id)) {
    ajv.addSchema(schema, schema.$id);
  }
  return schema.$id ?? localId;
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

function errorRegistryProblems(schemaId, data) {
  const validate = ajv.getSchema(schemaId);
  if (!validate) return ["missing compiled schema " + schemaId];

  const problems = [];
  if (!validate(data)) {
    problems.push(validate.errors?.[0]?.message ?? "schema validation failed");
  }

  const ids = new Set();
  const codes = new Set();
  for (const entry of data.codes ?? []) {
    if (ids.has(entry.id)) problems.push("duplicate error id " + entry.id);
    if (codes.has(entry.code)) problems.push("duplicate error code " + entry.code);
    ids.add(entry.id);
    codes.add(entry.code);
  }
  return problems;
}

function validateErrorRegistry(schemaId, registryRel, shouldPass) {
  const registryAbs = resolve(REPO_ROOT, registryRel);
  const problems = errorRegistryProblems(schemaId, readJson(registryAbs));
  if (shouldPass && problems.length > 0) {
    errors.push("valid error registry rejected: " + registryRel + " (" + problems[0] + ")");
  }
  if (!shouldPass && problems.length === 0) {
    errors.push("invalid error registry accepted: " + registryRel);
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
    schema: "protocol/schemas/graph-verification.schema.json",
    valid: ["protocol/fixtures/graph-verification/valid"],
    invalid: ["protocol/fixtures/graph-verification/invalid"],
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
];

registerCoreSchemas();
registerExtensionSchemas();

const errorRegistryId = registerSchema("protocol/schemas/error-code-registry.schema.json");
for (const registryRel of [
  "protocol/error-codes.json",
  "protocol/extensions/merkle/error-codes.json",
  "protocol/extensions/signing/error-codes.json",
]) {
  validateErrorRegistry(errorRegistryId, registryRel, true);
}
const coreRegistry = readJson(resolve(REPO_ROOT, "protocol/error-codes.json"));
const duplicateIdRegistry = structuredClone(coreRegistry);
duplicateIdRegistry.codes.push({
  ...duplicateIdRegistry.codes[0],
  code: "ALX_SYNTHETIC_DUPLICATE_ID",
});
const duplicateCodeRegistry = structuredClone(coreRegistry);
duplicateCodeRegistry.codes.push({
  ...duplicateCodeRegistry.codes[0],
  id: "ERR-999",
});
for (const [label, registry] of [
  ["duplicate-id", duplicateIdRegistry],
  ["duplicate-code", duplicateCodeRegistry],
]) {
  if (errorRegistryProblems(errorRegistryId, registry).length === 0) {
    errors.push("invalid error registry accepted: " + label);
  }
}

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

console.log(
  `Fixture schema verification passed (${validCount} valid, ${invalidCount} invalid; 3 error registries, 2 error-registry negative cases).`,
);
