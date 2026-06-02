#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const errors = [];

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relPath), "utf-8"));
}

const limits = readJson("protocol/limits.json");
const canonicalization = readJson("protocol/canonicalization.json");
const hashing = readJson("protocol/hashing.json");
const verifier = readJson("protocol/verifier.json");
const graphVerifier = readJson("protocol/graph-verifier.json");
const defs = readJson("protocol/schemas/defs.schema.json");

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${expected}, got ${actual}`);
  }
}

const normativeParents = limits.normativeProtocolLimits.find((e) => e.id === "LIMIT-001")?.value;
const normativeDepth = limits.normativeProtocolLimits.find((e) => e.id === "LIMIT-002")?.value;
const safetyBytes = limits.implementationSafetyLimits.find((e) => e.id === "LIMIT-101")?.value;

expectEqual("LIMIT-001 parent max", normativeParents, 256);
expectEqual("LIMIT-002 depth max", normativeDepth, 128);
expectEqual("canonicalization.limits.maxDepth", canonicalization.limits?.maxDepth, normativeDepth);
expectEqual("hashing.parentHashes.maxItems", hashing.parentHashes?.maxItems, normativeParents);
expectEqual(
  "defs.parentHashes.maxItems",
  defs.$defs?.parentHashes?.maxItems,
  normativeParents,
);
expectEqual(
  "canonicalization safety bytes",
  canonicalization.limits?.maxSerializedBytes?.value,
  safetyBytes,
);
expectEqual("hashing algorithm", hashing.algorithm, "keccak256");

const parentRule = verifier.steps.find((s) => s.id === "PARENT-004");
if (!parentRule?.rule?.includes("256")) {
  errors.push("verifier PARENT-004 must reference 256 parent limit");
}

const depthRule = canonicalization.steps.find((s) => s.id === "CANON-014");
if (!depthRule?.rule?.includes("128")) {
  errors.push("canonicalization CANON-014 must reference depth 128");
}

function collectIds(items, key, file) {
  const ids = new Set();
  for (const item of items) {
    const id = item[key];
    if (!id) continue;
    if (ids.has(id)) errors.push(`${file}: duplicate rule id ${id}`);
    ids.add(id);
  }
  return ids;
}

const verifierIds = collectIds(verifier.steps, "id", "verifier.json");
const graphIds = collectIds(graphVerifier.rules, "id", "graph-verifier.json");

for (const id of verifierIds) {
  if (graphIds.has(id)) {
    errors.push(`rule id collision between verifier.json and graph-verifier.json: ${id}`);
  }
}

for (const step of verifier.steps) {
  if (!step.graphVerifierRule) continue;
  if (!graphIds.has(step.graphVerifierRule)) {
    errors.push(`verifier ${step.id} references missing graph-verifier rule ${step.graphVerifierRule}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Protocol limit and verifier-catalog alignment passed.");
