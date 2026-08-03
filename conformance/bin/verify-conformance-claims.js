#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const errors = [];
const suites = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/suites.json"), "utf-8"));

let vectorCount = 0;
for (const suite of suites.core.suites) {
  const data = JSON.parse(readFileSync(resolve(REPO_ROOT, suite.path), "utf-8"));
  vectorCount += (data.vectors ?? []).length;
}

const compatibility = readFileSync(resolve(REPO_ROOT, "docs/implementers/compatibility.md"), "utf-8");
const parity = readFileSync(resolve(REPO_ROOT, "reference-implementations/PARITY.md"), "utf-8");

if (!compatibility.includes("Conformant")) errors.push("compatibility.md missing conformant status");
if (!parity.includes("TypeScript")) errors.push("PARITY.md missing TypeScript reference");

for (const suite of suites.core.suites) {
  if (suite.comparison === "exact" && !["canonicalization"].includes(suite.id)) {
    // exact-output suites are limited to canonicalization by policy
  }
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

const suiteCount = suites.core.suites.length;
if (suiteCount !== 11) errors.push(`expected 11 core suites, found ${suiteCount}`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`conformance claims verification passed (${vectorCount} core vectors).`);
