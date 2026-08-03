#!/usr/bin/env node

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-node-tests.js <test-directory>");
  process.exit(2);
}

function collectTests(directory, files = []) {
  for (const name of readdirSync(directory).sort()) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) collectTests(path, files);
    else if (name.endsWith(".test.js")) files.push(path);
  }
  return files;
}

const files = collectTests(resolve(target));
if (files.length === 0) {
  console.error(`No .test.js files found under ${target}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...files], {
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
