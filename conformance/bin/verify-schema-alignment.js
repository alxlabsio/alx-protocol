#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";
import { SCHEMA_HOST } from "../../.github/scripts/build-protocol-site.js";

const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/protocol.manifest.json"), "utf-8"));
const errors = [];

function checkPath(label, relPath) {
  const full = resolve(REPO_ROOT, "protocol", relPath.replace(/^\.\//, ""));
  if (!existsSync(full)) errors.push(`${label}: missing ${relPath}`);
}

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relPath), "utf-8"));
}

function expectSchemaId(relPath, expectedId) {
  const schema = readJson(relPath);
  if (schema.$id !== expectedId) {
    errors.push(`${relPath}: expected $id ${expectedId}, got ${schema.$id ?? "(missing)"}`);
  }
}

for (const [name, relPath] of Object.entries(manifest.core.schemas)) {
  checkPath(`schema:${name}`, relPath);
  expectSchemaId(
    join("protocol", relPath.replace(/^\.\//, "")),
    `${SCHEMA_HOST}/protocol/1/schemas/${basename(relPath)}`,
  );
}

const testVectorSchema = "protocol/schemas/test-vector.schema.json";
if (existsSync(resolve(REPO_ROOT, testVectorSchema))) {
  expectSchemaId(testVectorSchema, `${SCHEMA_HOST}/protocol/1/schemas/test-vector.schema.json`);
}

for (const relPath of [
  manifest.core.spec,
  manifest.core.canonicalization,
  manifest.core.hashing,
  manifest.core.verification,
  manifest.core.graphVerification,
  manifest.core.limits,
  manifest.core.errors,
  manifest.core.suites,
].filter(Boolean)) {
  checkPath("core", relPath);
}

for (const ext of manifest.extensions) {
  checkPath(`extension:${ext.id}`, ext.manifest);
  const extManifest = readJson(join("protocol", ext.manifest.replace(/^\.\//, "")));
  for (const schemaEntry of extManifest.schemas ?? []) {
    const schemaRel = schemaEntry.path.replace(/^\.\//, "");
    const schemaFile = basename(schemaRel);
    expectSchemaId(
      schemaRel,
      `${SCHEMA_HOST}/extensions/${ext.id}/1/schemas/${schemaFile}`,
    );
  }
}

const suites = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/suites.json"), "utf-8"));
for (const suite of suites.core.suites) {
  const full = resolve(REPO_ROOT, suite.path);
  if (!existsSync(full)) errors.push(`suite path missing: ${suite.path}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Schema alignment verification passed.");
