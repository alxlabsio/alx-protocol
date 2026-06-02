#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const suites = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/suites.json"), "utf-8"));
const runnerIds = new Set([
  "canonicalization",
  "canonicalization-negative",
  "canonicalization-depth",
  "block-identity",
  "parent-limits",
  "attribution-trace",
  "lineage-negative",
  "lineage-boundaries",
  "semantic-validity",
  "semantic-integrity",
]);

const errors = [];

for (const suite of suites.core.suites) {
  if (!runnerIds.has(suite.id)) errors.push(`missing runner registration for suite ${suite.id}`);
  if (!["exact", "semantic"].includes(suite.comparison)) errors.push(`invalid comparison for suite ${suite.id}`);
  const path = resolve(REPO_ROOT, suite.path);
  if (!existsSync(path)) errors.push(`missing suite file ${suite.path}`);
}

for (const ext of suites.extensions) {
  const manifestPath = resolve(REPO_ROOT, ext.manifest);
  if (!existsSync(manifestPath)) errors.push(`missing extension manifest ${ext.manifest}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Suite model verification passed.");
