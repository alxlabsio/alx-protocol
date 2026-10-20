#!/usr/bin/env node

import { renameSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { ed25519 } from "@noble/curves/ed25519";
import { p256 } from "@noble/curves/p256";
import sha3pkg from "js-sha3";

const { keccak_256 } = sha3pkg;
const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
const DOMAIN = "ALX-ATTESTATION-V1\0";
const ED25519_KEY = Uint8Array.from({ length: 32 }, (_, index) => index);
const P256_KEY = Uint8Array.from({ length: 32 }, (_, index) => index === 31 ? 1 : 0);
const VECTOR_PATHS = Object.freeze([
  "protocol/extensions/signing/test-vectors/signed-blocks.json",
  "protocol/extensions/signing/test-vectors/ed25519-attestations.json",
  "protocol/extensions/signing/test-vectors/p256-attestations.json",
]);

const hex = (value) => `0x${Buffer.from(value).toString("hex")}`;
const bytes = (value) => Uint8Array.from(Buffer.from(value.slice(2), "hex"));
const tamper = (signature) => `${signature.slice(0, -2)}${signature.endsWith("ff") ? "00" : "ff"}`;

function resolveInside(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  const fromRoot = relative(root, absolutePath);
  if (fromRoot === "" || fromRoot.startsWith("..") || fromRoot.split(sep).includes("..")) {
    throw new Error(`Vector path escapes generator root: ${relativePath}`);
  }
  return absolutePath;
}

function readDocument(root, relativePath) {
  const absolutePath = resolveInside(root, relativePath);
  let source;
  try {
    source = readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
  try {
    const document = JSON.parse(source);
    if (!Array.isArray(document.vectors)) throw new Error("vectors must be an array");
    return { source, document };
  } catch (error) {
    throw new Error(`${relativePath}: invalid vector JSON (${error.message})`);
  }
}

function vectorById(document, relativePath, id) {
  const matches = document.vectors.filter((vector) => vector.id === id);
  if (matches.length !== 1) {
    throw new Error(`${relativePath}: expected exactly one vector with ID ${id}`);
  }
  return matches[0];
}

function replaceFileAtomically(absolutePath, content) {
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  const backupPath = `${absolutePath}.bak-${process.pid}`;
  writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  let backedUp = false;
  try {
    renameSync(absolutePath, backupPath);
    backedUp = true;
    renameSync(temporaryPath, absolutePath);
    rmSync(backupPath, { force: true });
  } catch (error) {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
    if (backedUp && !existsSync(absolutePath)) renameSync(backupPath, absolutePath);
    throw error;
  }
}

async function canonicalizer() {
  const modulePath = pathToFileURL(resolve(REPOSITORY_ROOT, "sdk/dist/canonicalization.js")).href;
  try {
    return (await import(modulePath)).canonicalizeProtocolJson;
  } catch (error) {
    throw new Error(`Canonical SDK build is unavailable; run pnpm build (${error.message})`);
  }
}

function attestationDigest(attestation, canonicalizeProtocolJson) {
  return bytes(`0x${keccak_256(DOMAIN + canonicalizeProtocolJson({
    algorithm: attestation.algorithm,
    attester: attestation.attester,
    blockHash: attestation.blockHash,
    timestamp: attestation.timestamp,
  }))}`);
}

function updatePortableAttestations(document, relativePath, ids, algorithm, publicKey, sign, canonicalizeProtocolJson) {
  const positive = vectorById(document, relativePath, ids.positive).input?.attestation;
  const negative = vectorById(document, relativePath, ids.negative).input?.attestation;
  if (!positive || !negative) throw new Error(`${relativePath}: selected vectors require input.attestation`);

  positive.attester = hex(publicKey);
  positive.algorithm = algorithm;
  positive.signature = hex(sign(attestationDigest(positive, canonicalizeProtocolJson)));

  negative.attester = positive.attester;
  negative.algorithm = algorithm;
  negative.blockHash = positive.blockHash;
  negative.timestamp = positive.timestamp;
  negative.signature = tamper(positive.signature);
}

function updateSignedBlocks(document, relativePath, canonicalizeProtocolJson) {
  for (const vector of document.vectors) {
    if (typeof vector.id !== "string") throw new Error(`${relativePath}: vector missing stable ID`);
    const attestations = vector.input?.attestations
      ?? (vector.input?.attestation ? [vector.input.attestation] : []);
    for (const attestation of attestations) {
      attestation.signature = `${attestation.attester}:${Buffer.from(attestationDigest(attestation, canonicalizeProtocolJson)).toString("hex")}`;
    }
    if (vector.input?.attestation && vector.input?.attestations) {
      const singular = vector.input.attestation;
      singular.signature = `${singular.attester}:${Buffer.from(attestationDigest(singular, canonicalizeProtocolJson)).toString("hex")}`;
    }
  }
}

export async function generateSigningVectors(root = REPOSITORY_ROOT) {
  const canonicalizeProtocolJson = await canonicalizer();
  const generated = new Map();
  for (const relativePath of VECTOR_PATHS) {
    const { source, document } = readDocument(root, relativePath);
    if (relativePath.endsWith("signed-blocks.json")) {
      updateSignedBlocks(document, relativePath, canonicalizeProtocolJson);
    } else if (relativePath.endsWith("ed25519-attestations.json")) {
      updatePortableAttestations(
        document,
        relativePath,
        { positive: "ED25519-1", negative: "ED25519-2" },
        "ed25519",
        ed25519.getPublicKey(ED25519_KEY),
        (message) => ed25519.sign(message, ED25519_KEY),
        canonicalizeProtocolJson,
      );
    } else if (relativePath.endsWith("p256-attestations.json")) {
      updatePortableAttestations(
        document,
        relativePath,
        { positive: "P256-1", negative: "P256-2" },
        "p256",
        p256.getPublicKey(P256_KEY, false),
        (message) => p256.sign(message, P256_KEY).toCompactRawBytes(),
        canonicalizeProtocolJson,
      );
    }
    generated.set(relativePath, { source, output: `${JSON.stringify(document, null, 2)}\n` });
  }
  return generated;
}

export async function runSigningVectorGenerator({ mode, root = REPOSITORY_ROOT }) {
  if (!["check", "write"].includes(mode)) throw new Error(`Unsupported generator mode: ${mode}`);
  const generated = await generateSigningVectors(root);
  const stale = [];
  for (const [relativePath, { source, output }] of generated) {
    if (source === output) continue;
    stale.push(relativePath);
    if (mode === "write") replaceFileAtomically(resolveInside(root, relativePath), output);
  }
  if (mode === "check" && stale.length > 0) {
    throw new Error(`Stale signing vectors:\n${stale.join("\n")}`);
  }
  return { checked: generated.size, updated: mode === "write" ? stale.length : 0 };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--check", "--write"].includes(args[0])) {
    throw new Error("Usage: node scripts/protocol/regenerate-signing-vectors.mjs --check|--write");
  }
  const result = await runSigningVectorGenerator({ mode: args[0].slice(2) });
  process.stdout.write(
    args[0] === "--check"
      ? `Signing vector check passed (${result.checked} files; no files written).\n`
      : `Signing vectors updated (${result.updated}/${result.checked} files).\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
