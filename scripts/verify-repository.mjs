#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "../conformance/lib/repo-root.js";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "_site",
  "artifacts",
  "cache",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "typechain-types",
]);

export function snapshotRepository(root = REPO_ROOT) {
  const entries = new Map();
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (EXCLUDED_DIRECTORIES.has(name)) continue;
      const absolutePath = join(directory, name);
      const stats = lstatSync(absolutePath);
      const repositoryPath = relative(root, absolutePath).split(sep).join("/");
      if (stats.isSymbolicLink()) {
        entries.set(repositoryPath, "symlink");
      } else if (stats.isDirectory()) {
        visit(absolutePath);
      } else if (stats.isFile()) {
        entries.set(
          repositoryPath,
          createHash("sha256").update(readFileSync(absolutePath)).digest("hex"),
        );
      }
    }
  }
  visit(resolve(root));
  return entries;
}

export function diffSnapshots(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths]
    .sort()
    .filter((path) => before.get(path) !== after.get(path))
    .map((path) => {
      if (!before.has(path)) return `created ${path}`;
      if (!after.has(path)) return `deleted ${path}`;
      return `modified ${path}`;
    });
}

function runPnpm(script) {
  const packageManagerPath = process.env.npm_execpath;
  const command = packageManagerPath ? process.execPath : "pnpm";
  const args = packageManagerPath
    ? [packageManagerPath, "run", script]
    : ["run", script];
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm run ${script} failed with exit code ${result.status}`);
}

export function verifyRepository() {
  const before = snapshotRepository();
  let commandError;
  try {
    for (const script of [
      "format:check",
      "lint:all",
      "typecheck",
      "build",
      "test",
      "test:integration",
      "test:security",
      "test:fuzz",
      "test:extension",
      "test:contracts",
      "test:coverage",
      "protocol:signing-vectors:check",
      "protocol:site:check",
      "verify:protocol",
      "verify:cross-language",
    ]) {
      runPnpm(script);
    }
  } catch (error) {
    commandError = error;
  }
  const changes = diffSnapshots(before, snapshotRepository());
  if (changes.length > 0) {
    throw new Error(`verify mutated repository source state:\n${changes.join("\n")}`);
  }
  if (commandError) {
    throw new Error(`Repository source state unchanged; ${commandError.message}`);
  }
  process.stdout.write("Repository verification passed without source mutation.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verifyRepository();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
