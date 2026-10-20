#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeLfText, sha256Text } from "../../conformance/lib/text-digest.js";

const ROOT = resolve(import.meta.dirname, "../..");
const MANIFEST_PATH = "protocol/suites.json";
const CHECKSUM_PATH = "protocol/checksums.sha256";

function readJson(relativePath) {
  const absolutePath = resolveInsideRepository(relativePath);
  let source;
  try {
    source = readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
  try {
    return { document: JSON.parse(source), source };
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON (${error.message})`);
  }
}

function resolveInsideRepository(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("Artifact path must be a non-empty string");
  }
  const absolutePath = resolve(ROOT, relativePath);
  const relativePathFromRoot = relative(ROOT, absolutePath);
  if (
    relativePathFromRoot.startsWith("..")
    || relativePathFromRoot.split(sep).includes("..")
    || relativePathFromRoot === ""
  ) {
    throw new Error(`Artifact path escapes repository: ${relativePath}`);
  }
  return absolutePath;
}

function replaceFileAtomically(relativePath, content) {
  const absolutePath = resolveInsideRepository(relativePath);
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  const backupPath = `${absolutePath}.bak-${process.pid}`;
  writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  let backedUp = false;
  try {
    if (existsSync(absolutePath)) {
      renameSync(absolutePath, backupPath);
      backedUp = true;
    }
    renameSync(temporaryPath, absolutePath);
    if (backedUp) rmSync(backupPath, { force: true });
  } catch (error) {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
    if (backedUp && !existsSync(absolutePath)) renameSync(backupPath, absolutePath);
    throw error;
  }
}

function coreArtifactPaths(manifest) {
  const schemaPaths = readdirSync(resolve(ROOT, "protocol/schemas"))
    .filter((name) => name.endsWith(".schema.json"))
    .sort()
    .map((name) => `protocol/schemas/${name}`);
  return [
    "protocol/VERSION",
    "protocol/spec.md",
    "protocol/error-codes.json",
    MANIFEST_PATH,
    ...schemaPaths,
    ...manifest.core.suites.map((suite) => suite.path),
    "test-vectors/FORMAT.md",
    "test-vectors/CHANGELOG.md",
  ].sort();
}

function deriveArtifacts() {
  const { document: manifest } = readJson(MANIFEST_PATH);
  if (manifest.protocol !== "ALX" || manifest.vectorFormat !== "1") {
    throw new Error("protocol/suites.json: unsupported protocol or vector format");
  }
  if (!Array.isArray(manifest.core?.suites) || manifest.core.suites.length === 0) {
    throw new Error("protocol/suites.json: core.suites must be a non-empty array");
  }

  const desiredManifest = structuredClone(manifest);
  const suiteIds = new Set();
  const vectorIds = new Set();
  for (const suite of desiredManifest.core.suites) {
    if (suiteIds.has(suite.id)) throw new Error(`Duplicate suite ID: ${suite.id}`);
    suiteIds.add(suite.id);
    const { document, source } = readJson(suite.path);
    if (document.suite !== suite.id) {
      throw new Error(`${suite.path}: suite ${JSON.stringify(document.suite)} does not match ${suite.id}`);
    }
    if (!Array.isArray(document.vectors) || document.vectors.length === 0) {
      throw new Error(`${suite.path}: vectors must be a non-empty array`);
    }
    for (const vector of document.vectors) {
      if (typeof vector.id !== "string" || vector.id.length === 0) {
        throw new Error(`${suite.path}: vector without a stable ID`);
      }
      if (vectorIds.has(vector.id)) throw new Error(`Duplicate core vector ID: ${vector.id}`);
      vectorIds.add(vector.id);
      if (suite.operation === "per-vector" && typeof vector.operation !== "string") {
        throw new Error(`${suite.path}#${vector.id}: operation is required by the manifest`);
      }
    }
    suite.vectorCount = document.vectors.length;
    suite.sha256 = sha256Text(source);
  }

  const manifestContent = `${JSON.stringify(desiredManifest, null, 2)}\n`;
  const contentByPath = new Map([[MANIFEST_PATH, manifestContent]]);
  const checksumContent = coreArtifactPaths(desiredManifest)
    .map((relativePath) => {
      let content = contentByPath.get(relativePath);
      if (content === undefined) {
        try {
          content = readFileSync(resolveInsideRepository(relativePath), "utf8");
        } catch (error) {
          throw new Error(`${relativePath}: ${error.message}`);
        }
      }
      return `${sha256Text(content)}  ${relativePath}`;
    })
    .join("\n") + "\n";

  return { manifestContent, checksumContent, suiteCount: suiteIds.size, vectorCount: vectorIds.size };
}

function checkFile(relativePath, expected) {
  if (!existsSync(resolveInsideRepository(relativePath))) return `${relativePath} is missing`;
  const actual = readFileSync(resolveInsideRepository(relativePath), "utf8");
  return normalizeLfText(actual) === expected ? null : `${relativePath} is stale`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--check", "--write"].includes(args[0])) {
    throw new Error("Usage: node scripts/protocol/conformance-artifacts.mjs --check|--write");
  }
  const { manifestContent, checksumContent, suiteCount, vectorCount } = deriveArtifacts();
  if (args[0] === "--write") {
    replaceFileAtomically(MANIFEST_PATH, manifestContent);
    replaceFileAtomically(CHECKSUM_PATH, checksumContent);
    process.stdout.write(`Updated ${suiteCount} suites, ${vectorCount} vectors, and ${CHECKSUM_PATH}.\n`);
    return;
  }

  const errors = [
    checkFile(MANIFEST_PATH, manifestContent),
    checkFile(CHECKSUM_PATH, checksumContent),
  ].filter(Boolean);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  process.stdout.write(`Conformance artifact check passed (${suiteCount} suites, ${vectorCount} vectors).\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
