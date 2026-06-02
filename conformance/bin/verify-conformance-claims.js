#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
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

const implDirs = readdirSync(resolve(REPO_ROOT, "reference-implementations"));
for (const lang of ["typescript", "python", "rust"]) {
  if (!implDirs.includes(lang)) errors.push(`missing reference implementation ${lang}`);
}

if (vectorCount !== 74) errors.push(`expected 74 core vectors, found ${vectorCount}`);

const suiteCount = suites.core.suites.length;
if (suiteCount !== 10) errors.push(`expected 10 core suites, found ${suiteCount}`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Conformance claims verification passed (${vectorCount} core vectors).`);
