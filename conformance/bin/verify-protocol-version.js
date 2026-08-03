#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../lib/repo-root.js";

const errors = [];
const version = readFileSync(resolve(REPO_ROOT, "protocol/VERSION"), "utf-8").trim();
const suites = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "protocol/suites.json"), "utf-8"),
);

if (!/^[1-9][0-9]*$/.test(version)) {
  errors.push(
    "protocol/VERSION must contain a positive integer, got " + JSON.stringify(version),
  );
}

if (String(suites.protocolVersion) !== version) {
  errors.push(
    "protocol/suites.json protocolVersion " +
      suites.protocolVersion +
      " != protocol/VERSION " +
      version,
  );
}

for (const relPath of [
  "protocol/spec.md",
  "protocol/schemas",
  "protocol/test-vectors",
  "protocol/error-codes.json",
  "protocol/suites.json",
]) {
  if (!existsSync(resolve(REPO_ROOT, relPath))) {
    errors.push("missing canonical protocol surface " + relPath);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Protocol version alignment passed.");
