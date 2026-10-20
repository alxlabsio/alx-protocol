#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";
import { loadCoreManifest } from "../lib/manifest.js";

const errors = [];
const { suites: loadedSuites, vectorIds } = loadCoreManifest();

const vectorCount = vectorIds.size;

const compatibility = readFileSync(resolve(REPO_ROOT, "docs/implementers/implementation-compatibility-matrix.md"), "utf-8");
const parity = readFileSync(resolve(REPO_ROOT, "reference-implementations/PARITY.md"), "utf-8");

if (!compatibility.includes("Conformant")) errors.push("implementation-compatibility-matrix.md missing conformant status");
if (!parity.includes("TypeScript")) errors.push("PARITY.md missing TypeScript reference");

for (const { descriptor: suite } of loadedSuites) {
  if (suite.comparison !== "exact" && suite.comparison !== "semantic") {
    errors.push(`suite ${suite.id} has invalid comparison ${suite.comparison}`);
  }
}

const implementations = {
  typescript: "sdk/conformance-adapter.js",
  python: "reference-implementations/python/conformance_adapter.py",
  rust: "reference-implementations/rust/src/bin/conformance_adapter.rs",
};
for (const [language, adapter] of Object.entries(implementations)) {
  if (!existsSync(resolve(REPO_ROOT, adapter))) {
    errors.push(`missing reference implementation ${language}: ${adapter}`);
  }
}

if (vectorCount === 0) errors.push("no core vectors found");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`conformance claims verification passed (${vectorCount} core vectors).`);
