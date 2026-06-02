#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "../lib/repo-root.js";

function callAdapter(cmd, args, operation, input) {
  const payload = `${JSON.stringify({ operation, input })}\n`;
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    input: payload,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  const line = result.stdout.trim().split("\n").filter(Boolean).pop();
  const parsed = JSON.parse(line);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.output ?? parsed;
}

const rustBin = resolve(REPO_ROOT, "reference-implementations/rust/target/release/conformance_adapter");
const rustBinExe = `${rustBin}.exe`;
const rustPath = existsSync(rustBinExe) ? rustBinExe : rustBin;

const impls = [
  { name: "typescript", cmd: "node", args: ["sdk/conformance-adapter.js"] },
  { name: "python", cmd: "python", args: ["reference-implementations/python/conformance_adapter.py"] },
];
if (existsSync(rustPath)) {
  impls.push({ name: "rust", cmd: rustPath, args: [] });
}

const vectors = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/test-vectors/block-identity.json"), "utf-8"));
const sampleInputs = vectors.vectors.filter((v) => v.input).slice(0, 5).map((v) => v.input);

const available = [];
for (const impl of impls) {
  try {
    callAdapter(impl.cmd, impl.args, "createBlock", sampleInputs[0]);
    available.push(impl);
  } catch (err) {
    console.error(`Skipping ${impl.name}: ${err.message}`);
  }
}

if (available.length < 2) {
  console.error("Need at least two implementations for differential core check.");
  process.exit(1);
}

for (const input of sampleInputs) {
  const hashes = available.map((impl) => callAdapter(impl.cmd, impl.args, "createBlock", input).blockHash);
  const first = hashes[0];
  for (const hash of hashes.slice(1)) {
    if (hash !== first) {
      console.error(`Differential mismatch for input ${JSON.stringify(input)}: ${hashes.join(" != ")}`);
      process.exit(1);
    }
  }
}

console.log(`Differential core check passed across ${available.map((i) => i.name).join(", ")}.`);
