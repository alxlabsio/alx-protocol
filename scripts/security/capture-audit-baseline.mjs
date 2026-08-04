#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const AUDIT_SURFACES = Object.freeze([
  { id: "canonical-protocol", paths: ["protocol"] },
  { id: "typescript-sdk", paths: ["sdk/src", "sdk/package.json"] },
  {
    id: "peer-implementations",
    paths: [
      "reference-implementations/python",
      "reference-implementations/rust/src",
      "reference-implementations/rust/tests",
      "reference-implementations/rust/Cargo.toml",
      "reference-implementations/rust/Cargo.lock",
    ],
  },
  { id: "conformance", paths: ["conformance"] },
  { id: "shells-and-storage", paths: ["cli", "adapters"] },
  { id: "optional-contracts", paths: ["contracts"] },
  {
    id: "supply-chain-and-release",
    paths: [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".github",
      "SECURITY.md",
      "GOVERNANCE.md",
    ],
  },
]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function aggregateFileEntries(entries) {
  const manifest = [...entries]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path, sha256: fileHash }) => `${fileHash}  ${path}\n`)
    .join("");
  return sha256(manifest);
}

function runRequired(command, args) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runOptional(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    return { status: "unavailable", value: null };
  }
  return { status: "captured", value: (result.stdout || result.stderr).trim() };
}

export function collectTrackedFiles(paths) {
  const output = runRequired("git", ["ls-files", "--", ...paths]);
  return output ? output.split(/\r?\n/).filter(Boolean).sort() : [];
}

export function captureSurface(surface) {
  const files = collectTrackedFiles(surface.paths).map((path) => ({
    path,
    sha256: sha256(readFileSync(resolve(REPO_ROOT, path))),
  }));
  return {
    id: surface.id,
    paths: surface.paths,
    fileCount: files.length,
    aggregateSha256: aggregateFileEntries(files),
    files,
  };
}

function readPackageVersion(packagePath, dependencyName) {
  const packageJson = JSON.parse(
    readFileSync(resolve(REPO_ROOT, packagePath), "utf8"),
  );
  return (
    packageJson.dependencies?.[dependencyName] ??
    packageJson.devDependencies?.[dependencyName] ??
    null
  );
}

export function captureBaseline(capturedAt = new Date().toISOString()) {
  const status = runRequired("git", ["status", "--porcelain"]);
  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return {
    schemaVersion: "1.0.0",
    reviewType: "internal-security-review",
    capturedAt,
    repository: {
      url: runRequired("git", ["config", "--get", "remote.origin.url"]),
      commit: runRequired("git", ["rev-parse", "HEAD"]),
      branch: runRequired("git", ["branch", "--show-current"]),
      worktreeClean: status.length === 0,
      worktreeStatus: status ? status.split(/\r?\n/) : [],
    },
    protocolVersion: readFileSync(
      resolve(REPO_ROOT, "protocol/VERSION"),
      "utf8",
    ).trim(),
    toolchain: {
      node: { status: "captured", value: process.version },
      pnpm: runOptional(pnpmCommand, ["--version"]),
      python: runOptional("python", ["--version"]),
      rustc: runOptional("rustc", ["--version"]),
      cargo: runOptional("cargo", ["--version"]),
      typescript: {
        status: "declared",
        value: readPackageVersion("package.json", "typescript"),
      },
      hardhat: {
        status: "declared",
        value: readPackageVersion("contracts/package.json", "hardhat"),
      },
    },
    surfaces: AUDIT_SURFACES.map(captureSurface),
  };
}

export function parseArgs(argv) {
  const args = { output: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--") continue;
    if (argv[index] === "--output" && argv[index + 1]) {
      args.output = argv[++index];
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  return args;
}

function main() {
  const { output } = parseArgs(process.argv.slice(2));
  const serialized = `${JSON.stringify(captureBaseline(), null, 2)}\n`;
  if (!output) {
    process.stdout.write(serialized);
    return;
  }
  const outputPath = resolve(REPO_ROOT, output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized);
  process.stdout.write(`${outputPath}\n`);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
