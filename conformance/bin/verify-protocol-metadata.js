#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/protocol.manifest.json"), "utf-8"));
const versionFile = readFileSync(resolve(REPO_ROOT, "protocol/VERSION"), "utf-8").trim();
const errors = [];

if (String(manifest.protocolVersion) !== versionFile) {
  errors.push(`protocol.manifest protocolVersion ${manifest.protocolVersion} != protocol/VERSION ${versionFile}`);
}

const required = [
  resolve(REPO_ROOT, "protocol/spec.md"),
  resolve(REPO_ROOT, "protocol/verifier.json"),
  resolve(REPO_ROOT, "protocol/graph-verifier.json"),
  resolve(REPO_ROOT, "protocol/suites.json"),
];

for (const path of required) {
  if (!existsSync(path)) errors.push(`missing protocol artifact ${path}`);
}

for (const ext of manifest.extensions) {
  const path = resolve(REPO_ROOT, "protocol", ext.manifest.replace(/^\.\//, ""));
  if (!existsSync(path)) errors.push(`missing extension manifest ${ext.manifest}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Protocol metadata verification passed.");
