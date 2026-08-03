#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";
import { SCHEMA_HOST } from "../../scripts/build-protocol-site.js";

const PROTOCOL_ROOT = resolve(REPO_ROOT, "protocol");
const META_SCHEMA = "https://json-schema.org/draft/2020-12/schema";
const ERROR_REGISTRY_SCHEMA = "[Placeholder]";
const PUBLIC_SCHEMA_URL_PLACEHOLDER = "[Placeholder]";
const errors = [];

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, "utf-8"));
}

function walkJson(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkJson(full, out);
    } else if (name.endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function repoPath(absPath) {
  return relative(REPO_ROOT, absPath).split(sep).join("/");
}

function expectedSchemaId(relPath) {
  const core = relPath.match(/^protocol\/schemas\/([^/]+)$/);
  if (core) return SCHEMA_HOST + "/protocol/1/schemas/" + core[1];

  const extension = relPath.match(
    /^protocol\/extensions\/([^/]+)\/schemas\/([^/]+)$/,
  );
  if (extension) {
    return (
      SCHEMA_HOST +
      "/extensions/" +
      extension[1] +
      "/1/schemas/" +
      extension[2]
    );
  }

  return null;
}

const jsonFiles = walkJson(PROTOCOL_ROOT);
const schemaFiles = jsonFiles.filter((file) => file.endsWith(".schema.json"));

for (const schemaFile of schemaFiles) {
  const relPath = repoPath(schemaFile);
  const expectedId = expectedSchemaId(relPath);
  if (!expectedId) {
    errors.push("schema outside supported schema directories: " + relPath);
    continue;
  }

  const schema = readJson(schemaFile);
  if (schema.$schema !== META_SCHEMA) {
    errors.push(relPath + ": expected $schema " + META_SCHEMA);
  }
  if (schema.$id !== undefined) {
    errors.push(relPath + ": temporary public schema URL must remain unset");
  }
  if (!schema.$comment?.includes(PUBLIC_SCHEMA_URL_PLACEHOLDER)) {
    errors.push(relPath + ": missing temporary [Placeholder] URL marker");
  }
}

for (const jsonFile of jsonFiles) {
  if (jsonFile.endsWith(".schema.json")) continue;
  const data = readJson(jsonFile);
  if (data.$schema === META_SCHEMA) {
    errors.push(
      repoPath(jsonFile) +
        ": non-schema document must not declare the JSON Schema metaschema",
    );
  }
}

for (const relPath of [
  "protocol/error-codes.json",
  "protocol/extensions/merkle/error-codes.json",
  "protocol/extensions/signing/error-codes.json",
]) {
  const absPath = resolve(REPO_ROOT, relPath);
  if (!existsSync(absPath)) {
    errors.push("missing error registry " + relPath);
    continue;
  }
  const registry = readJson(absPath);
  if (registry.$schema !== ERROR_REGISTRY_SCHEMA) {
    errors.push(
      relPath +
        ": expected $schema " +
        ERROR_REGISTRY_SCHEMA +
        ", got " +
        (registry.$schema ?? "(missing)"),
    );
  }
}

const suites = readJson(resolve(REPO_ROOT, "protocol/suites.json"));
for (const suite of suites.core.suites) {
  if (!existsSync(resolve(REPO_ROOT, suite.path))) {
    errors.push("suite path missing: " + suite.path);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  "Schema alignment verification passed (" + schemaFiles.length + " schemas checked).",
);
