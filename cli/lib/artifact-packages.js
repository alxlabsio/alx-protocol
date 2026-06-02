import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sdk from "./sdk.js";
import { cidV1RawSha256, parseCidString } from "./cid.js";
import { readProtocolVersion } from "./protocol-version.js";

const {
  validateBlock,
  deriveContentHash,
  deriveBlockHash,
  buildGraph,
  validateGraph,
  verifyGraph,
  traceAttribution,
  verifyTrace,
} = sdk;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readBytes(path) {
  return readFileSync(path);
}

function normalizeHashList(list) {
  return [...new Set((list ?? []).map((h) => h.toLowerCase()))].sort();
}

function stableJson(value) {
  return JSON.stringify(value);
}

function tracesMatch(expected, graph, context) {
  const verification = verifyTrace(expected, graph, context);
  return verification.ok;
}

function findBlockFile(packageDir, blockHash) {
  const target = blockHash.toLowerCase();
  for (const name of readdirSync(packageDir)) {
    if (!name.endsWith(".json")) continue;
    if (["manifest.json", "blocks.json", "parents.json", "trace.json", "verification.json", "verification-context.json"].includes(name)) {
      continue;
    }
    const full = join(packageDir, name);
    if (!statSync(full).isFile()) continue;
    try {
      const data = readJson(full);
      if (data.blockHash?.toLowerCase() === target) return full;
    } catch {
      // skip non-block json
    }
  }
  return null;
}

function resolvePrimaryBlockPaths(dir, manifest) {
  const contentPath = join(dir, "content.json");
  const blockPath = join(dir, "block.json");

  if (existsSync(blockPath)) {
    return {
      blockPath,
      contentPath: existsSync(contentPath) ? contentPath : null,
      inlineContent: !existsSync(contentPath),
    };
  }

  const manifestPrimary = manifest?.files?.primaryBlock;
  if (typeof manifestPrimary === "string") {
    const manifestBlockPath = join(dir, manifestPrimary);
    if (existsSync(manifestBlockPath)) {
      return {
        blockPath: manifestBlockPath,
        contentPath: existsSync(contentPath) ? contentPath : null,
        inlineContent: !existsSync(contentPath),
      };
    }
  }

  const outputPath = join(dir, "output.json");
  if (existsSync(outputPath)) {
    return {
      blockPath: outputPath,
      contentPath: existsSync(contentPath) ? contentPath : null,
      inlineContent: !existsSync(contentPath),
    };
  }

  return null;
}

function resolveGraphRoot(context, primaryBlock) {
  return (context.graphRoot ?? context.rootBlockHash ?? primaryBlock.blockHash)?.toLowerCase();
}

function verifyManifestCids(packageDir, manifest, primaryBlockPath, issues) {
  let cidVerified = true;
  const contentPath = join(packageDir, "content.json");

  if (existsSync(primaryBlockPath) && manifest.blockCid) {
    try {
      parseCidString(manifest.blockCid);
      const computed = cidV1RawSha256(readBytes(primaryBlockPath));
      if (computed !== manifest.blockCid) {
        cidVerified = false;
        issues.push("manifest_block_cid_mismatch");
      }
    } catch {
      cidVerified = false;
      issues.push("manifest_block_cid_invalid");
    }
  }

  if (existsSync(contentPath) && manifest.contentCid) {
    try {
      parseCidString(manifest.contentCid);
      const computed = cidV1RawSha256(readBytes(contentPath));
      if (computed !== manifest.contentCid) {
        cidVerified = false;
        issues.push("manifest_content_cid_mismatch");
      }
    } catch {
      cidVerified = false;
      issues.push("manifest_content_cid_invalid");
    }
  }

  for (const parent of manifest.parents ?? []) {
    if (!parent.cid || !parent.blockHash) continue;
    try {
      parseCidString(parent.cid);
    } catch {
      cidVerified = false;
      issues.push(`manifest_parent_cid_invalid:${parent.blockHash}`);
      continue;
    }
    const parentFile = findBlockFile(packageDir, parent.blockHash);
    if (!parentFile) continue;
    const computed = cidV1RawSha256(readBytes(parentFile));
    if (computed !== parent.cid) {
      cidVerified = false;
      issues.push(`manifest_parent_cid_mismatch:${parent.blockHash}`);
    }
  }

  return cidVerified;
}

function buildReplayReceipt(root, graphResult, trace, validationMode, ok, issues, warnings) {
  return {
    receiptVersion: "1",
    protocolVersion: readProtocolVersion(),
    verifiedAt: 0,
    verifier: { name: "alx-package-verifier", version: "1.0.0" },
    root: root.toLowerCase(),
    validationMode,
    ok,
    complete: trace.complete,
    blockCount: graphResult.blocks,
    edgeCount: graphResult.edges,
    externalParents: graphResult.externalParents,
    missingParents: trace.missingParents,
    errors: issues,
    warnings,
  };
}

function receiptFieldsMatch(receipt, replay) {
  const summaryReceipt = receipt.receiptVersion == null;
  if (summaryReceipt) {
    return (
      Boolean(receipt.ok) === Boolean(replay.ok) &&
      Boolean(receipt.complete) === Boolean(replay.complete) &&
      stableJson(normalizeHashList(receipt.externalParents ?? [])) === stableJson(normalizeHashList(replay.externalParents)) &&
      stableJson(normalizeHashList(receipt.missingParents ?? [])) === stableJson(normalizeHashList(replay.missingParents))
    );
  }

  return (
    Boolean(receipt.ok) === Boolean(replay.ok) &&
    Boolean(receipt.complete) === Boolean(replay.complete) &&
    receipt.blockCount === replay.blockCount &&
    receipt.edgeCount === replay.edgeCount &&
    stableJson(normalizeHashList(receipt.externalParents)) === stableJson(normalizeHashList(replay.externalParents)) &&
    stableJson(normalizeHashList(receipt.missingParents)) === stableJson(normalizeHashList(replay.missingParents))
  );
}

export async function validateArtifactPackage(packageDir) {
  const dir = resolve(packageDir);
  const issues = [];
  const warnings = [];

  if (!existsSync(join(dir, "manifest.json"))) {
    issues.push("missing_file:manifest.json");
    return { ok: false, complete: false, issues, warnings, cidVerified: false };
  }

  const manifest = readJson(join(dir, "manifest.json"));
  const primaryPaths = resolvePrimaryBlockPaths(dir, manifest);
  if (!primaryPaths) {
    issues.push("missing_primary_block");
    return { ok: false, complete: false, issues, warnings, cidVerified: false };
  }

  const required = ["blocks.json", "verification-context.json", "trace.json", "verification.json"];
  for (const file of required) {
    if (!existsSync(join(dir, file))) {
      issues.push(`missing_file:${file}`);
      return { ok: false, complete: false, issues, warnings, cidVerified: false };
    }
  }

  if (!primaryPaths.inlineContent && !primaryPaths.contentPath) {
    issues.push("missing_file:content.json");
    return { ok: false, complete: false, issues, warnings, cidVerified: false };
  }

  const primaryBlock = readJson(primaryPaths.blockPath);
  const content = primaryPaths.contentPath ? readJson(primaryPaths.contentPath) : primaryBlock.content;
  const blocks = readJson(join(dir, "blocks.json"));
  const context = readJson(join(dir, "verification-context.json"));
  const expectedTrace = readJson(join(dir, "trace.json"));
  const receipt = readJson(join(dir, "verification.json"));

  const cidVerified = verifyManifestCids(dir, manifest, primaryPaths.blockPath, issues);

  const primaryValidation = validateBlock(primaryBlock);
  if (!primaryValidation.ok) issues.push("primary_block_invalid");

  const manifestBlockHash = manifest.blockHash ?? manifest.primaryBlock;
  if (manifestBlockHash && primaryBlock.blockHash?.toLowerCase() !== manifestBlockHash.toLowerCase()) {
    issues.push("manifest_block_hash_mismatch");
  }
  if (manifest.contentHash && primaryBlock.contentHash?.toLowerCase() !== manifest.contentHash.toLowerCase()) {
    issues.push("manifest_content_hash_mismatch");
  }

  const contentHash = deriveContentHash(content);
  if (primaryBlock.contentHash?.toLowerCase() !== contentHash.toLowerCase()) {
    issues.push("primary_content_hash_mismatch");
  }

  const graphContext = {
    validationMode: context.validationMode ?? "closed-world",
    externalParents: context.externalParents ?? [],
  };
  const externalSet = new Set(graphContext.externalParents.map((p) => p.hash.toLowerCase()));

  const verifyResult = verifyGraph(blocks, deriveBlockHash);
  for (const broken of verifyResult.broken) {
    if (broken.reason === "parent_not_found" && broken.parentHash && externalSet.has(broken.parentHash.toLowerCase())) {
      continue;
    }
    issues.push(`included_block_invalid:${broken.blockHash}`);
  }
  const graph = buildGraph(blocks);
  const graphResult = validateGraph(graph, graphContext);
  if (!graphResult.ok) issues.push("graph_invalid");

  const root = resolveGraphRoot(context, primaryBlock);
  const trace = traceAttribution(root, graph, graphContext);
  if (!tracesMatch(expectedTrace, graph, graphContext)) issues.push("trace_mismatch");

  const structuralOk = issues.length === 0;
  const replayReceipt = buildReplayReceipt(root, graphResult, trace, graphContext.validationMode, structuralOk, [], warnings);
  if (!receiptFieldsMatch(receipt, replayReceipt)) {
    issues.push("receipt_ok_does_not_match_validation_result");
  }

  return {
    ok: structuralOk,
    complete: trace.complete,
    blockHash: primaryBlock.blockHash?.toLowerCase(),
    contentHash: primaryBlock.contentHash?.toLowerCase(),
    validationMode: graphContext.validationMode,
    blockCount: graphResult.blocks,
    edgeCount: graphResult.edges,
    missingParents: trace.missingParents,
    externalParents: graphResult.externalParents,
    cidVerified,
    issues,
    warnings,
  };
}

export async function validateReceiptAgainstPackage(receiptFile, packageDir) {
  const receipt = readJson(resolve(receiptFile));
  const replay = await validateArtifactPackage(packageDir);
  const replayReceipt = {
    ok: replay.ok,
    complete: replay.complete,
    blockCount: replay.blockCount,
    edgeCount: replay.edgeCount,
    externalParents: replay.externalParents,
    missingParents: replay.missingParents,
  };
  const stored = {
    ok: receipt.ok,
    complete: receipt.complete,
    blockCount: receipt.blockCount,
    edgeCount: receipt.edgeCount,
    externalParents: receipt.externalParents,
    missingParents: receipt.missingParents,
  };
  const receiptMatchesReplay = receiptFieldsMatch(receipt, replayReceipt);
  const issues = [];
  if (!receiptMatchesReplay) issues.push("receipt_ok_does_not_match_validation_result");
  return {
    ok: receiptMatchesReplay && replay.ok === receipt.ok,
    blockHash: replay.blockHash,
    receiptOk: receipt.ok,
    replayOk: replay.ok,
    receiptComplete: receipt.complete,
    replayComplete: replay.complete,
    receiptMatchesReplay,
    issues,
  };
}

function isPackageDir(dir) {
  if (!existsSync(join(dir, "manifest.json")) || !existsSync(join(dir, "blocks.json"))) {
    return false;
  }
  if (existsSync(join(dir, "block.json"))) {
    return true;
  }
  try {
    const manifest = readJson(join(dir, "manifest.json"));
    const primaryFile = manifest?.files?.primaryBlock;
    if (typeof primaryFile === "string" && existsSync(join(dir, primaryFile))) {
      return true;
    }
  } catch {
    return false;
  }
  return existsSync(join(dir, "output.json"));
}

async function runBatchValidation() {
  const packagesRoot = resolve(process.cwd(), "artifact-packages");
  const failures = [];

  for (const name of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const pkgRoot = join(packagesRoot, name.name);

    if (name.name === "tampered-package-detection") {
      const valid = join(pkgRoot, "valid");
      const tampered = join(pkgRoot, "tampered");
      const validResult = await validateArtifactPackage(valid);
      if (!validResult.ok) failures.push(`${valid}: expected pass`);
      const tamperedResult = await validateArtifactPackage(tampered);
      if (tamperedResult.ok) failures.push(`${tampered}: expected fail`);
      continue;
    }

    if (isPackageDir(pkgRoot)) {
      const result = await validateArtifactPackage(pkgRoot);
      if (!result.ok) failures.push(`${pkgRoot}: ${result.issues.join(", ")}`);
    }
  }

  if (failures.length > 0) {
    console.error("Artifact package validation failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("All artifact packages validated.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBatchValidation().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
