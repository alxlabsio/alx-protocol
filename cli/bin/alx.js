#!/usr/bin/env node

/**
 * ALX Protocol CLI
 *
 * Commands include: init, validate, inspect, block create/link/show/list, hash batch,
 * trace, proof, test-vectors run, conformance run,
 * extension-conformance, serve, and version.
 */

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { readProtocolVersion } from "../lib/protocol-version.js";
import sdk from "../lib/sdk.js";
import {
  green, red, dim, bold, ok, fail, info, json, die, dieJson, readInput, parseJson,
  appendBlockToGraph,
} from "../lib/cli-utils.js";
import { parseBlockCreateArgs, parseBlockLinkArgs, parseParentReferences } from "../lib/cli-args.js";
import { persistBlockWrite, listRecentFromState, listAllFromState } from "../lib/cli-state.js";
import {
  resolveBlockReferenceToPath,
  resolveParentTokensToHashes,
  findBlockJsonFilesInCwd,
} from "../lib/parent-resolve.js";
import { checkContentType, knownContentTypes, CONTENT_TYPE_SCHEMAS } from "../lib/content-types.js";
import { fetchFromIpfs, fetchFromS3, fetchFromUrl, s3EnvStatus, ipfsEnvStatus, retrievalEnvStatus } from "../lib/storage-providers.js";
import { basename } from "node:path";
import { startServer } from "../server/server.js";
import { startRetrievalServer } from "../server/retrieval-server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const localEnvPath = resolve(process.cwd(), ".env");
if (existsSync(localEnvPath)) {
  try {
    process.loadEnvFile(localEnvPath);
  } catch (err) {
    die(`Unable to load ${localEnvPath}: ${err.message}`);
  }
}

const {
  canonicalizeProtocolJson,
  createBlock,
  validateBlock,
  deriveBlockHash,
  deriveContentHash,
  validateGraph,
  buildGraph,
  traceAttribution,
} = sdk;

const ALX_VERSION = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8")).version;
const PROTOCOL_VERSION = readProtocolVersion();

const PROVIDER_ENV_STUBS = {
  s3: `# S3-compatible object storage (AWS S3, Cloudflare R2, MinIO)
ALX_S3_BUCKET=
ALX_S3_REGION=us-east-1
ALX_S3_ACCESS_KEY_ID=
ALX_S3_SECRET_ACCESS_KEY=
# Leave blank for AWS. Set for R2/MinIO.
ALX_S3_ENDPOINT=
`,
  ipfs: `# IPFS (local Kubo node)
ALX_IPFS_ENDPOINT=http://localhost:5001
ALX_IPFS_GATEWAY=https://ipfs.io/ipfs
`,
  retrieval: `# ALX Retrieval server (shared team Block store)
ALX_RETRIEVAL_ENDPOINT=http://localhost:8081
ALX_RETRIEVAL_API_KEY=
`,
};

function cmdInit(args) {
  // alx init --provider <s3|ipfs|retrieval>
  const providerIdx = args.indexOf("--provider");
  if (providerIdx !== -1) {
    const provider = args[providerIdx + 1];
    if (!provider || !PROVIDER_ENV_STUBS[provider]) {
      die(`Unknown provider: ${provider || "(none)"}. Choose: s3, ipfs, retrieval`);
    }
    const envPath = resolve(process.cwd(), ".env");
    const stub = PROVIDER_ENV_STUBS[provider];
    if (existsSync(envPath)) {
      const existing = readFileSync(envPath, "utf-8");
      if (existing.includes(`ALX_${provider.toUpperCase()}`)) {
        info(`  .env already contains ${provider.toUpperCase()} config — not overwriting`);
      } else {
        writeFileSync(envPath, existing + "\n" + stub);
        ok(`Appended ${provider} config to .env`);
      }
    } else {
      writeFileSync(envPath, stub);
      ok(`Created .env with ${provider} config`);
    }
    info(dim(`  Fill in your credentials, then: alx doctor`));
    console.log();
    return;
  }

  const dir = args[0] || "alx-starter";
  const target = resolve(process.cwd(), dir);

  if (existsSync(target)) die(`Directory already exists: ${dir}`);

  console.log(`\n${bold("ALX Protocol")} — Creating starter project\n`);

  mkdirSync(target, { recursive: true });

  // Create example blocks
  const research = createBlock(
    { type: "ai.prompt", text: "Analyze market trends for Q4" },
    []
  );
  const synthesis = createBlock(
    { type: "ai.response", text: "Market analysis shows growth in AI infrastructure" },
    [research.blockHash]
  );
  const decision = createBlock(
    { type: "decision", text: "Proceed with AI infrastructure investment" },
    [research.blockHash, synthesis.blockHash]
  );

  persistBlockWrite({ block: research, outPath: join(target, "research.block.json"), cwd: target });
  ok("Created research.block.json (root block)");

  persistBlockWrite({ block: synthesis, outPath: join(target, "synthesis.block.json"), cwd: target });
  ok(`Created synthesis.block.json (parent: research)`);

  persistBlockWrite({ block: decision, outPath: join(target, "decision.block.json"), cwd: target });
  ok(`Created decision.block.json (parents: research + synthesis)`);

  writeFileSync(join(target, ".gitignore"), ".alx/\n");

  const graph = [research, synthesis, decision];
  writeFileSync(join(target, "graph.json"), JSON.stringify(graph, null, 2) + "\n");
  ok("Created graph.json (full DAG)");

  // Create a tampered block to demonstrate validation rejection
  const tampered = { ...research, content: { type: "tampered", text: "this won't validate" } };
  writeFileSync(join(target, "tampered.block.json"), JSON.stringify(tampered, null, 2) + "\n");
  ok("Created tampered.block.json (invalid — for testing)");

  console.log(`\n${bold("Next steps:")}\n`);
  console.log(`  cd ${dir}`);
  console.log(`  alx block verify research.block.json`);
  console.log(`  alx block verify tampered.block.json`);
  console.log(`  alx block inspect decision.block.json`);
  console.log(`  alx graph trace ${decision.blockHash.slice(0, 18)}... --file graph.json`);
  console.log(`  alx test-vectors run`);
  console.log();
}
function cmdValidate(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--")) die("Usage: alx block verify <reference> | alx graph verify <file>");

  const input = readInput(filePath);
  const data = parseJson(input);

  console.log();

  if (Array.isArray(data)) {
    // Validate array of blocks
    let allOk = true;
    for (const block of data) {
      const result = validateBlock(block);
      if (result.ok) {
        ok(`${block.blockHash.slice(0, 18)}... ${green("valid")}`);
      } else {
        fail(`${block.blockHash.slice(0, 18)}... ${red("INVALID")}`);
        info(`  expected: ${result.expected}`);
        info(`  actual:   ${result.actual}`);
        allOk = false;
      }
    }

    // Also validate graph structure
    const graph = buildGraph(data);
    const graphResult = validateGraph(graph);
    console.log();
    if (graphResult.ok) {
      ok(`DAG structure valid (${graphResult.blocks} blocks, ${graphResult.edges} edges)`);
    } else {
      fail(`DAG structure issues: ${graphResult.issues.length} problem(s)`);
      allOk = false;
    }

    ok(dim(`alx-protocol TypeScript v${ALX_VERSION}`));
    console.log();
    process.exit(allOk ? 0 : 1);
  } else {
    // Single block
    if (!data.blockHash) die("Input must be a Block object with blockHash, content, and parentHashes");
    const result = validateBlock(data);
    if (result.ok) {
      ok(`Block is ${green("valid")}`);
      info(`  Hash:          ${data.blockHash}`);
      info(`  Content hash:  ${data.contentHash || deriveContentHash(data.content)}`);
      info(`  Parents:       ${(data.parentHashes || []).length}`);
      info(`  Protocol:      v${PROTOCOL_VERSION}`);
    } else {
      fail(`Block is ${red("INVALID")}`);
      info(`  expected hash: ${result.expected}`);
      info(`  actual hash:   ${result.actual}`);
      info(`  Content or parentHashes have been modified after block creation.`);
    }
    console.log();
    process.exit(result.ok ? 0 : 1);
  }
}

function cmdInspect(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--")) die("Usage: alx block inspect <file>");

  const input = readInput(filePath);
  const block = parseJson(input);

  if (!block.blockHash) die("Input must be a Block object");

  const result = validateBlock(block);
  const canonical = canonicalizeProtocolJson({
    content: block.content ?? null,
    parentHashes: block.parentHashes ?? [],
  });
  const contentCanonical = canonicalizeProtocolJson(block.content ?? null);

  const pad = (s) => s.padEnd(16);
  console.log(`\n${bold("Block Inspection")}\n`);
  console.log(`  ${bold(pad("blockHash"))}  ${block.blockHash}`);
  console.log(`  ${bold(pad("contentHash"))}  ${block.contentHash || deriveContentHash(block.content)}`);
  console.log(`  ${bold(pad("parentHashes"))}  ${(block.parentHashes || []).length === 0 ? "(none — this is a root block)" : ""}`);
  for (const p of block.parentHashes || []) {
    console.log(`  ${"".padEnd(16)}    ${dim(p)}`);
  }
  console.log(`  ${bold(pad("content"))}  ${typeof block.content === "object" ? JSON.stringify(block.content) : String(block.content)}`);
  console.log();
  console.log(`  ${bold(pad("Canonical form"))}  ${canonical.length} bytes`);
  console.log(`  ${bold(pad("Content canonical"))}  ${contentCanonical.length} bytes`);
  console.log(`  ${bold(pad("Integrity"))}  ${result.ok ? green("VALID — hash matches content + parents") : red("INVALID — hash does not match")}`);
  console.log(`  ${bold(pad("Protocol"))}  v${PROTOCOL_VERSION}`);
  console.log();
}

function printBlockCreated(block, { storedPath, outPath, graphPath, label = "Block created" }) {
  console.log();
  ok(label);
  console.log(`  ${bold("blockHash")}    ${block.blockHash}`);
  console.log(`  ${bold("contentHash")} ${block.contentHash}`);
  console.log(`  ${bold("parents")}      ${block.parentHashes.length}`);
  if (storedPath) console.log(`  ${bold("stored")}       ${storedPath}`);
  if (outPath && outPath !== storedPath) console.log(`  ${bold("copied")}       ${outPath}`);
  if (graphPath) console.log(`  ${bold("graph")}        appended to ${graphPath}`);
  console.log();
  console.log(dim("  Use --json for machine-readable output"));
  console.log();
}

function dieInput(err, useJson = false) {
  const msg = err instanceof Error ? err.message : String(err);
  if (useJson) dieJson(msg);
  else die(msg);
}

async function cmdBlockCreate(args) {
  const useJson = args.includes("--json");

  // ── --from-* fetch shortcuts ──────────────────────────────────────────────
  const fromIpfsIdx = args.indexOf("--from-ipfs");
  const fromS3Idx = args.indexOf("--from-s3");
  const fromUrlIdx = args.indexOf("--from-url");
  let fetchedContent = null;

  if (fromIpfsIdx !== -1) {
    const cid = args[fromIpfsIdx + 1];
    if (!cid || cid.startsWith("--")) dieInput(new Error("--from-ipfs requires a CID"), useJson);
    try {
      fetchedContent = await fetchFromIpfs(cid);
    } catch (err) { dieInput(err, useJson); return; }
  } else if (fromS3Idx !== -1) {
    const uri = args[fromS3Idx + 1];
    if (!uri || uri.startsWith("--")) dieInput(new Error("--from-s3 requires an s3://bucket/key URI"), useJson);
    try {
      fetchedContent = await fetchFromS3(uri);
    } catch (err) { dieInput(err, useJson); return; }
  } else if (fromUrlIdx !== -1) {
    const url = args[fromUrlIdx + 1];
    if (!url || url.startsWith("--")) dieInput(new Error("--from-url requires a URL"), useJson);
    try {
      fetchedContent = await fetchFromUrl(url);
    } catch (err) { dieInput(err, useJson); return; }
  }

  let parsed;
  if (fetchedContent) {
    // Synthetic parsed result — content comes from the fetch, not arg parsing
    const outIdx = args.indexOf("--out");
    const outPath = outIdx !== -1 ? resolve(process.cwd(), args[outIdx + 1]) : null;
    const graphPath = args.indexOf("--append-graph") !== -1
      ? resolve(process.cwd(), args[args.indexOf("--append-graph") + 1])
      : null;
    parsed = {
      content: fetchedContent,
      contentSource: "fetch",
      parents: parseParentReferences(args),
      outPath,
      graphPath,
      json: useJson,
      dryRun: args.includes("--dry-run"),
      validateParents: args.includes("--validate-parents"),
    };
  } else {
    try {
      parsed = parseBlockCreateArgs(args);
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  }

  let parentHashes = [];
  if (parsed.parents.length > 0) {
    try {
      parentHashes = resolveParentTokensToHashes(parsed.parents, {
        cwd: process.cwd(),
        validateSeal: parsed.validateParents ? validateBlock : undefined,
      });
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  }

  const block = createBlock(parsed.content, parentHashes);

  // Content type warnings (advisory only — never block creation)
  const warnings = checkContentType(parsed.content);
  if (warnings.length > 0 && !parsed.json) {
    for (const w of warnings) console.log(`  ${dim("⚠")} ${dim(w)}`);
  }

  let persisted = null;
  if (!parsed.dryRun) {
    try {
      persisted = persistBlockWrite({ block, outPath: parsed.outPath });
      if (parsed.graphPath) appendBlockToGraph(parsed.graphPath, block);
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  }

  if (parsed.json) {
    if (parsed.dryRun) json({ ok: true, dryRun: true, block });
    else json(block);
  } else {
    printBlockCreated(block, {
      storedPath: parsed.dryRun ? null : persisted?.canonicalPath,
      outPath: parsed.dryRun ? null : parsed.outPath,
      graphPath: parsed.dryRun ? null : parsed.graphPath,
      label: parsed.dryRun ? "Block (dry-run)" : "Block created",
    });
    if (parsed.dryRun) {
      console.log(dim("  --dry-run: hashes computed, no files written, state not updated"));
      console.log();
    }
  }
  process.exit(0);
}

async function cmdBlockLink(args) {
  const useJson = args.includes("--json");
  let parsed;
  try {
    parsed = parseBlockLinkArgs(args);
  } catch (err) {
    dieInput(err, useJson);
    return;
  }

  let parents;
  try {
    parents = resolveParentTokensToHashes(parsed.parentTokens, {
      cwd: process.cwd(),
      validateSeal: parsed.validateParents ? validateBlock : undefined,
    });
  } catch (err) {
    dieInput(err, useJson);
    return;
  }

  const block = createBlock(parsed.content, parents);

  const warnings = checkContentType(parsed.content);
  if (warnings.length > 0 && !parsed.json) {
    for (const w of warnings) console.log(`  ${dim("⚠")} ${dim(w)}`);
  }

  let persisted = null;
  if (!parsed.dryRun) {
    try {
      persisted = persistBlockWrite({ block, outPath: parsed.outPath });
      if (parsed.graphPath) appendBlockToGraph(parsed.graphPath, block);
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  }

  if (parsed.json) {
    if (parsed.dryRun) json({ ok: true, dryRun: true, block });
    else json(block);
  } else {
    printBlockCreated(block, {
      storedPath: parsed.dryRun ? null : persisted?.canonicalPath,
      outPath: parsed.dryRun ? null : parsed.outPath,
      graphPath: parsed.dryRun ? null : parsed.graphPath,
      label: parsed.dryRun ? "Block (dry-run)" : "Block linked",
    });
    if (parsed.dryRun) {
      console.log(dim("  --dry-run: hashes computed, no files written, state not updated"));
      console.log();
    }
  }
  process.exit(0);
}

function cmdBlockList(args) {
  const showAll = args.includes("--all");
  const recentIdx = args.indexOf("--recent");
  let limit = 10;
  if (recentIdx !== -1) {
    const n = Number.parseInt(args[recentIdx + 1], 10);
    if (!Number.isFinite(n) || n < 1) die("--recent requires a positive number");
    limit = n;
  }

  const cwd = process.cwd();
  const fromState = showAll ? listAllFromState(cwd) : listRecentFromState(cwd, limit);
  const seen = new Set(fromState.map((r) => r.blockHash));
  const diskFiles = findBlockJsonFilesInCwd(cwd);

  const rows = fromState.map((entry) => {
    const availablePath = [entry.path, ...(entry.outputPaths ?? [])].find((path) => path && existsSync(path));
    return {
      blockHash: entry.blockHash,
      contentHash: entry.contentHash ?? null,
      parentHashes: entry.parentHashes ?? [],
      path: entry.path ?? null,
      outputPaths: entry.outputPaths ?? [],
      createdAt: entry.createdAt ?? null,
      available: Boolean(availablePath),
      source: "index",
    };
  });
  for (const file of diskFiles) {
    if (!showAll && rows.length >= limit) break;
    try {
      const block = JSON.parse(readFileSync(file, "utf-8"));
      const hash = String(block.blockHash || "").toLowerCase();
      if (!hash || seen.has(hash)) continue;
      seen.add(hash);
      rows.push({
        blockHash: hash,
        contentHash: block.contentHash ?? null,
        parentHashes: block.parentHashes ?? [],
        path: file,
        outputPaths: [],
        createdAt: null,
        available: true,
        source: "cwd",
      });
    } catch {
      // skip invalid
    }
  }

  if (args.includes("--json")) {
    json({
      cwd,
      count: rows.length,
      blocks: rows.map((r) => ({
        blockHash: r.blockHash,
        contentHash: r.contentHash,
        parentHashes: r.parentHashes,
        path: r.path,
        outputPaths: r.outputPaths,
        createdAt: r.createdAt,
        available: r.available,
        source: r.source,
      })),
    });
    return;
  }

  console.log(`\n${bold(showAll ? "All Indexed Blocks" : "Recent Blocks")} (${cwd})\n`);
  if (rows.length === 0) {
    info("  No blocks in .alx/state.json or *.block.json in this directory.");
    info("  Create one: alx block create --content-file ./data.json --out research.block.json");
    console.log();
    return;
  }

  for (const row of rows) {
    const label = row.path ? basename(row.path) : row.blockHash;
    const when = row.createdAt ? dim(`  ${row.createdAt}`) : dim("  (on disk)");
    const availability = row.available ? "" : dim("  unavailable");
    info(`  ${label}`);
    info(`    ${row.blockHash.slice(0, 18)}...${when}${availability}`);
  }
  console.log();
  console.log(dim("  Parent shorthand: @last  @latest  @parent"));
  console.log();
}

function cmdBlockShow(args) {
  const reference = args.find((arg) => !arg.startsWith("--"));
  if (!reference) die("Usage: alx block show <hash|prefix|@last|file>");
  let path;
  try {
    path = resolveBlockReferenceToPath(reference, { cwd: process.cwd() });
  } catch (err) {
    dieInput(err, args.includes("--json"));
    return;
  }
  const block = parseJson(readInput(path));
  json(block);
}

function cmdBlockVerify(args) {
  const reference = args.find((arg) => !arg.startsWith("--"));
  if (!reference) die("Usage: alx block verify <hash|prefix|@last|file>");
  let path;
  try {
    path = resolveBlockReferenceToPath(reference, { cwd: process.cwd() });
  } catch (err) {
    dieInput(err, args.includes("--json"));
    return;
  }
  return cmdValidate([path]);
}

function cmdBlockTypes(args) {
  if (args.includes("--json")) {
    json(Object.entries(CONTENT_TYPE_SCHEMAS).map(([type, schema]) => ({ type, ...schema })));
    return;
  }
  console.log(`\n${bold("Known content types")}\n`);
  for (const [type, schema] of Object.entries(CONTENT_TYPE_SCHEMAS)) {
    console.log(`  ${bold(type)}`);
    console.log(`  ${dim(schema.description)}`);
    if (schema.required?.length) console.log(`    required: ${schema.required.join(", ")}`);
    if (schema.oneOf?.length)    console.log(`    one of:  ${schema.oneOf.map(g => g.join("+")).join(" | ")}`);
    if (schema.optional?.length) console.log(`    optional: ${dim(schema.optional.join(", "))}`);
    console.log();
  }
  console.log(dim("  The protocol does not enforce content shape. These are advisory schemas."));
  console.log();
}

async function cmdBlock(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "create")  return await cmdBlockCreate(rest);
  if (sub === "link")    return cmdBlockLink(rest);
  if (sub === "list")    return cmdBlockList(rest);
  if (sub === "show")    return cmdBlockShow(rest);
  if (sub === "types")   return cmdBlockTypes(rest);
  if (sub === "verify")  return cmdBlockVerify(rest);
  if (sub === "inspect") return cmdInspect(rest);
  if (sub === "proof")   return cmdProof(rest);
  if (sub === "publish") return await cmdPublish(rest);
  if (sub === "resolve") return await cmdResolve(rest);
  die("Usage: alx block create | link | show | list | types | verify | inspect | proof | publish | resolve");
}

async function cmdGraph(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "verify") return cmdValidate(rest);
  if (sub === "trace")  return cmdTrace(rest);
  die("Usage: alx graph verify | trace");
}

function cmdTrace(args) {
  const rootHash = args[0];
  if (!rootHash || rootHash.startsWith("--")) die("Usage: alx graph trace <root-hash> --file <graph.json>");

  const remaining = args.slice(1);
  const input = readInput(remaining);
  const data = parseJson(input);

  let graph;
  const contentTypes = new Map(); // hash → content.type label
  if (Array.isArray(data)) {
    graph = buildGraph(data);
    for (const b of data) {
      if (b.blockHash && b.content && typeof b.content === "object" && b.content.type) {
        contentTypes.set(b.blockHash.toLowerCase(), String(b.content.type));
      }
    }
  } else if (data && typeof data === "object") {
    graph = new Map(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v : []]));
  } else {
    die("Input must be an array of blocks or a hash\u2192parents object");
  }

  // Resolve prefix hash to full hash (allows short hashes like 0x6fbf65cb...)
  let resolvedHash = rootHash;
  const prefix = rootHash.toLowerCase().replace(/\.\.\.$/, "");
  const allHashes = [...graph.keys()];
  const matches = allHashes.filter(h => h.toLowerCase().startsWith(prefix));
  if (matches.length === 1) {
    resolvedHash = matches[0];
  } else if (matches.length > 1) {
    die(`Ambiguous hash prefix '${rootHash}' matches ${matches.length} blocks. Provide more characters.`);
  }

  const trace = traceAttribution(resolvedHash, graph);

  if (remaining.includes("--json")) {
    json(trace);
  } else {
    console.log(`\n${bold("Attribution Trace")}\n`);
    console.log(`  ${bold("Root")}       ${trace.root.slice(0, 18)}...`);
    console.log(`  ${bold("Nodes")}      ${trace.nodes.length}`);
    console.log(`  ${bold("Edges")}      ${trace.edges.length}`);
    console.log(`  ${bold("Leaves")}     ${trace.leaves.length}`);
    console.log(`  ${bold("Max depth")}  ${trace.maxDepth}`);
    console.log(`  ${bold("Cycles")}     ${trace.cycle ? red("YES") : green("none")}`);
    console.log();
    console.log(`  ${bold("Nodes")} ${dim("(sorted by depth)")}`);
    for (const node of trace.nodes) {
      const indent = "  ".repeat(node.minDepth);
      const pathInfo = node.pathCount > 1 ? ` ${dim(`(${node.pathCount} paths)`)}` : "";
      const label = contentTypes.has(node.hash) ? `  ${dim("[" + contentTypes.get(node.hash) + "]")}` : "";
      console.log(`    ${indent}${node.hash.slice(0, 18)}... depth=${node.minDepth}${pathInfo}${label}`);
    }
    console.log();
    console.log(`  ${bold("Leaves")} ${dim("(original sources)")}`);
    for (const leaf of trace.leaves) {
      const label = contentTypes.has(leaf) ? `  ${dim("[" + contentTypes.get(leaf) + "]")}` : "";
      console.log(`    ${leaf.slice(0, 18)}...${label}`);
    }
    console.log();
    const hasMultiPath = trace.nodes.some(n => n.pathCount > 1);
    if (hasMultiPath) {
      console.log(dim("  pathCount = independent causal paths from root to that ancestor"));
    }
    console.log(dim("  Use --json for machine-readable output"));
    console.log();
  }
}
async function cmdTestVectors(args) {
  if (args[0] !== "run") die("Usage: alx test-vectors run");
  return cmdConformance(["run", "--self-test"]);
}
async function cmdConformance(args) {
  if (args[0] !== "run") die("Usage: alx conformance run [--impl <command>]");

  const conformancePath = resolve(__dirname, "../../conformance/bin/run.js");
  if (!existsSync(conformancePath)) die("conformance runner not found.");

  // Forward args to conformance runner
  const { execFileSync } = await import("node:child_process");
  const implIdx = args.indexOf("--impl");
  const runArgs = [];

  if (implIdx !== -1 && args[implIdx + 1]) {
    runArgs.push("--impl", args[implIdx + 1]);
  } else {
    runArgs.push("--self-test");
  }

  try {
    execFileSync(process.execPath, [conformancePath, ...runArgs], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}
async function cmdExtensionConformance(args) {
  const extension = args[0];
  if (!["merkle", "signing"].includes(extension)) die("Usage: alx extension-conformance <merkle|signing> [--impl <command>]");

  const runnerPath = resolve(__dirname, `../../conformance/bin/run-${extension}-extension.js`);
  if (!existsSync(runnerPath)) die(`${extension} extension conformance runner not found.`);

  const { execFileSync } = await import("node:child_process");
  const implIdx = args.indexOf("--impl");
  const runArgs = [];
  if (implIdx !== -1 && args[implIdx + 1]) runArgs.push("--impl", args[implIdx + 1]);

  try {
    execFileSync(process.execPath, [runnerPath, ...runArgs], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

async function cmdServe(args) {
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 8080;
  await startServer(port);
}

async function cmdServer(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "start") return await cmdServe(rest);
  die("Usage: alx server start [--port 8080]");
}

async function cmdRetrievalServe(args) {
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 8081;
  const dataDirIdx = args.indexOf("--data-dir");
  const gatewayIdx = args.indexOf("--gateway");
  const dataDir = dataDirIdx !== -1 ? resolve(process.cwd(), args[dataDirIdx + 1]) : undefined;
  const gateway = gatewayIdx !== -1 ? args[gatewayIdx + 1] : undefined;
  await startRetrievalServer(port, { dataDir, gateway });
}
function cmdProof(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--")) die("Usage: alx proof <block.json>");

  const input = readInput(filePath);
  const block = parseJson(input);

  if (!block.blockHash) die("Input must be a Block object with blockHash, content, and parentHashes");

  const rawParents = block.parentHashes || [];
  const sortedParents = [...new Set(
    rawParents.map(h => String(h).trim().toLowerCase()).filter(h => /^0x[a-f0-9]{64}$/.test(h))
  )].sort();

  const contentCanon = canonicalizeProtocolJson(block.content ?? null);
  const blockInput = canonicalizeProtocolJson({ content: block.content ?? null, parentHashes: sortedParents });
  const recomputedContentHash = deriveContentHash(block.content);
  const recomputedBlockHash = deriveBlockHash(block.content, rawParents);
  const storedBlockHash = String(block.blockHash).trim().toLowerCase();
  const valid = recomputedBlockHash === storedBlockHash;

  const contentType = block.content && typeof block.content === "object" && block.content.type
    ? String(block.content.type)
    : null;

  const TRUNC = 120;
  const truncate = (s) => s.length > TRUNC ? s.slice(0, TRUNC) + dim(`…(${s.length} bytes total)`) : `${s} ${dim(`(${s.length} bytes)`)}`;

  console.log(`\n${bold("Block Proof")}  ${dim(filePath)}\n`);

  // ── Layer 1: Content identity ──
  console.log(`  ${bold("── Content identity ──")}`);
  if (contentType) console.log(`  content type   ${dim(contentType)}`);
  console.log(`  contentHash    ${block.contentHash || dim("(not stored)")}`);
  console.log(`  canonical      ${truncate(contentCanon)}`);
  console.log(`                 ${dim(`keccak-256 →`)} ${recomputedContentHash}`);
  if (block.contentHash) {
    const chMatch = recomputedContentHash === String(block.contentHash).trim().toLowerCase();
    console.log(`                 ${chMatch ? green("✓ matches stored contentHash") : red("✗ stored contentHash does not match")}`);
  }
  console.log();

  // ── Layer 2: Block identity ──
  console.log(`  ${bold("── Block identity ──")}`);
  if (rawParents.length === 0) {
    console.log(`  Parents        ${dim("(none — this is a root block)")}`);
  } else {
    console.log(`  Parents (raw)  ${rawParents.length} hash${rawParents.length === 1 ? "" : "es"}`);
    for (const p of rawParents) console.log(`                   ${dim(p.slice(0, 18))}...`);
    if (JSON.stringify(rawParents.map(h => h.toLowerCase())) !== JSON.stringify(sortedParents)) {
      console.log(`  After sort     ${sortedParents.map(h => h.slice(0, 18) + "...").join(", ")}  ${dim("(lexicographic)")}`);
    } else {
      console.log(`  After sort     ${dim("already sorted")}`);
    }
    if (sortedParents.length < rawParents.length) {
      console.log(`  After dedup    ${sortedParents.length} unique  ${dim(`(${rawParents.length - sortedParents.length} duplicate(s) removed)`)}`);
    } else {
      console.log(`  After dedup    ${sortedParents.length} unique  ${dim("(no duplicates)")}`);
    }
  }
  console.log(`  Hash input     ${truncate(blockInput)}`);
  console.log(`                 ${dim(`keccak-256 →`)} ${recomputedBlockHash}`);
  console.log(`  blockHash      ${block.blockHash}`);
  console.log();

  // ── Layer 3: Integrity check ──
  console.log(`  ${bold("── Integrity check ──")}`);
  console.log(`  Recomputed     ${recomputedBlockHash}`);
  console.log(`  Stored         ${storedBlockHash}`);
  if (valid) {
    console.log(`  Result         ${green("✓ VALID — recomputed hash matches stored hash")}`);
  } else {
    console.log(`  Result         ${red("✗ INVALID — recomputed hash differs from stored hash")}`);
    console.log(`  ${dim("The content or parentHashes have been modified after this block was created.")}`);
  }
  console.log();

  // ── Anti-tamper note ──
  console.log(`  ${bold("── Anti-tamper ──")}`);
  console.log(`  Any change to ${bold("content")} or ${bold("parentHashes")} produces a different blockHash.`);
  console.log(`  ${dim("alx block verify")} recomputes from scratch — the stored blockHash is never trusted.`);
  if (contentType && contentType.includes("policy")) {
    console.log(`  ${dim("Example: change content.rules.minLength → blockHash changes → validation fails.")}`);
  } else if (contentType && contentType.includes("validator")) {
    console.log(`  ${dim("Example: change any line of content.code → blockHash changes → validation fails.")}`);
  } else {
    console.log(`  ${dim("Example: add, remove, or edit any field in content → blockHash changes → validation fails.")}`);
  }
  console.log();
}

/**
 * Strip a narrow subset of TypeScript annotations from a validatePassword function
 * so it can be eval-ed as plain JavaScript.
 *
 * Handles only the specific patterns expected by the locked validator contract:
 * the export keyword, the (password: string) parameter type, the return type
 * annotation, and const errors: string[] declarations.
 * It is not a general-purpose TypeScript stripper.
 */
function stripTypeAnnotations(tsCode) {
  return tsCode
    .replace(/export\s+function\s+validatePassword/, "function validatePassword")
    .replace(/\(password:\s*string\)/, "(password)")
    .replace(/\):\s*\{\s*ok:\s*boolean;\s*errors:\s*string\[\]\s*\}\s*\{/, ") {")
    .replace(/const\s+errors:\s*string\[\]/, "const errors");
}

async function cmdTestRouter(args) {
  if (args[0] !== "run") {
    die("Usage: alx test run <tests-block.json> --against <validator-block.json>");
  }
  return cmdTest(args.slice(1));
}
async function cmdTest(args) {
  const testsFile = args[0];
  const againstIdx = args.indexOf("--against");
  const validatorFile = againstIdx !== -1 ? args[againstIdx + 1] : null;

  if (!testsFile || !validatorFile) {
    die("Usage: alx test run <tests-block.json> --against <validator-block.json>");
  }

  const testsBlock = parseJson(readInput(testsFile));
  const validatorBlock = parseJson(readInput(validatorFile));

  if (!testsBlock.content?.cases) die("Tests block must have content.cases array");
  if (!validatorBlock.content?.code) die("Validator block must have content.code string");

  // Verify seals before running — refuse to test tampered blocks
  const tv = validateBlock(testsBlock);
  const vv = validateBlock(validatorBlock);
  if (!tv.ok) die(`Tests Block seal is broken — run alx block verify on the tests Block`);
  if (!vv.ok) die(`Validator Block seal is broken — run alx block verify on the validator Block`);

  // Strip TypeScript type annotations, write to a temp CJS file, load via createRequire
  const { createRequire } = await import("node:module");
  const { tmpdir } = await import("node:os");
  const { writeFileSync: wfs, unlinkSync } = await import("node:fs");
  const tmpFile = resolve(tmpdir(), `alx_test_${Date.now()}.js`);

  const js = stripTypeAnnotations(validatorBlock.content.code);

  wfs(tmpFile, js + "\nmodule.exports = { validatePassword };");

  let validatePassword;
  try {
    const req = createRequire(import.meta.url);
    validatePassword = req(tmpFile).validatePassword;
  } catch (e) {
    die(`Could not execute validator code: ${e.message}`);
  } finally {
    try { unlinkSync(tmpFile); } catch { /* non-fatal: OS temp dir handles cleanup */ }
  }

  if (typeof validatePassword !== "function") die("Validator block does not export validatePassword");

  console.log(`\n${bold("ALX Test Runner")}\n`);
  console.log(`  ${bold("Tests")}      ${testsBlock.blockHash.slice(0, 18)}...  ${dim("[" + (testsBlock.content.type ?? "tests") + "]")}`);
  console.log(`  ${bold("Validator")}  ${validatorBlock.blockHash.slice(0, 18)}...  ${dim("[" + (validatorBlock.content.type ?? "validator") + "]")}`);
  console.log();

  let passed = 0, failed = 0;
  for (const c of testsBlock.content.cases) {
    let result;
    try { result = validatePassword(c.input); }
    catch (e) { result = { ok: false, errors: [`runtime error: ${e.message}`] }; }

    const pass = result.ok === c.expectedOk;
    pass ? passed++ : failed++;

    const sym = pass ? green("\u2713") : red("\u2717");
    const expectedLabel = c.expectedOk ? "accepted" : "rejected";
    console.log(`  ${sym}  ${JSON.stringify(c.input).padEnd(36)} ${dim(expectedLabel)}`);
    if (!pass) {
      const actualLabel = result.ok ? "accepted" : "rejected";
      console.log(`       expected=${expectedLabel}  got=${actualLabel}  errors=${JSON.stringify(result.errors ?? [])}`);
    }
  }

  console.log();
  if (failed === 0) {
    ok(`${passed}/${passed + failed} cases passed — locked validator satisfies locked test spec`);
    ok(dim(`alx-protocol TypeScript v${ALX_VERSION}`));
  } else {
    fail(`${failed}/${passed + failed} cases failed — validator does not satisfy locked test spec`);
  }
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

async function cmdResolve(args) {
  const blockHash = args[0];
  if (!blockHash || blockHash.startsWith("--") || !/^0x[a-fA-F0-9]{64}$/.test(blockHash)) {
    die("Usage: alx block resolve <blockHash> [--cid-map <path>] [--gateway <url>] [--endpoint <url>] [--json]");
  }

  const cidMapIdx = args.indexOf("--cid-map");
  const gatewayIdx = args.indexOf("--gateway");
  const endpointIdx = args.indexOf("--endpoint");

  const opts = {
    cidMap: cidMapIdx !== -1 ? args[cidMapIdx + 1] : undefined,
    gateway: gatewayIdx !== -1 ? args[gatewayIdx + 1] : undefined,
    endpoint: endpointIdx !== -1 ? args[endpointIdx + 1] : undefined,
  };

  const { resolveBlock } = await import("../lib/resolve.js");
  const result = await resolveBlock(blockHash, opts);

  if (!result) {
    fail(`Block not found: ${blockHash.slice(0, 18)}...`);
    info(dim("  Publish with: alx block publish <block.json> --endpoint <retrieval-url>"));
    info(dim("  Or pin locally: alx block publish <block.json> --ipfs <endpoint>"));
    info(dim("  Or resolve via: alx block resolve <hash> --endpoint <url>"));
    console.log();
    process.exit(1);
  }

  if (args.includes("--json")) {
    json(result.block);
  } else {
    console.log(`\n${bold("Block Resolved")}\n`);
    ok(`${result.block.blockHash.slice(0, 18)}...  ${green("verified")}`);
    info(`  Source:   ${result.source}`);
    info(`  URL:      ${dim(result.url)}`);
    info(`  Parents:  ${result.block.parentHashes.length}`);
    console.log();
    console.log(dim("  Use --json for machine-readable output"));
    console.log();
  }
}

async function cmdPublish(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--")) {
    die("Usage: alx block publish <block.json> [--ipfs <endpoint>] [--endpoint <url>] [--api-key <key>] [--cid-map <path>] [--json]");
  }

  const ipfsIdx = args.indexOf("--ipfs");
  const retrievalIdx = args.indexOf("--endpoint");
  const hasIpfs = ipfsIdx !== -1;
  const hasRetrieval = retrievalIdx !== -1;
  const ipfsEndpoint = hasIpfs ? args[ipfsIdx + 1] : "http://localhost:5001";
  const retrievalEndpoint = hasRetrieval ? args[retrievalIdx + 1] : undefined;
  const cidMapIdx = args.indexOf("--cid-map");
  const cidMapPath = cidMapIdx !== -1 ? args[cidMapIdx + 1] : undefined;
  const gatewayIdx = args.indexOf("--gateway");
  const gatewayUrl = gatewayIdx !== -1 ? args[gatewayIdx + 1] : "https://ipfs.io/ipfs";
  const apiKeyIdx = args.indexOf("--api-key");
  const apiKey = apiKeyIdx !== -1 ? args[apiKeyIdx + 1] : process.env.ALX_RETRIEVAL_API_KEY;

  const block = parseJson(readInput(filePath));
  if (!block.blockHash) die("Input must be a Block object with blockHash, content, and parentHashes");

  const validation = validateBlock(block);
  if (!validation.ok) die("Block seal is broken — run alx block verify to see the diff");

  const { publishToIpfs, recordCidMapping, publishToRetrievalEndpoint } = await import("../lib/resolve.js");

  if (!args.includes("--json")) {
    console.log(`\n${bold("Publishing Block")}\n`);
    info(`  Block:    ${block.blockHash.slice(0, 18)}...`);
    if (hasIpfs || !hasRetrieval) info(`  IPFS:     ${dim(ipfsEndpoint)}`);
    if (retrievalEndpoint) info(`  HTTP:     ${dim(retrievalEndpoint)}`);
    console.log();
  }

  let cid;
  if (hasIpfs || !hasRetrieval) {
    try {
      cid = await publishToIpfs(block, ipfsEndpoint);
    } catch (err) {
      die(err.message);
    }
    recordCidMapping(block.blockHash, cid, "ipfs", cidMapPath);
  }

  if (retrievalEndpoint) {
    try {
      await publishToRetrievalEndpoint(block, retrievalEndpoint, { cid, apiKey });
    } catch (err) {
      die(err.message);
    }
  }

  const output = {
    blockHash: block.blockHash,
    ...(cid ? { cid, gatewayUrl: `${gatewayUrl.replace(/\/$/, "")}/${cid}` } : {}),
    ...(retrievalEndpoint ? { retrievalEndpoint } : {}),
  };

  if (args.includes("--json")) {
    json(output);
  } else {
    if (cid) {
      ok(`Pinned to IPFS`);
      info(`  CID:      ${cid}`);
      info(`  Gateway:  ${dim(`${gatewayUrl.replace(/\/$/, "")}/${cid}`)}`);
      info(`  CID map:  updated ~/.alx/cid-map.json`);
    }
    if (retrievalEndpoint) {
      ok(`Published to retrieval server`);
      info(`  Endpoint: ${retrievalEndpoint}`);
    }
    console.log();
    console.log(dim(`  Resolve later with: alx block resolve ${block.blockHash.slice(0, 18)}...`));
    if (retrievalEndpoint) {
      console.log(dim(`  Team resolve:       alx block resolve ${block.blockHash.slice(0, 18)}... --endpoint ${retrievalEndpoint}`));
    }
    console.log();
  }
}

async function cmdAnchorSingle(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--")) die("Usage: alx anchor create <block.json> [--rpc-url <url>] [--private-key <key>] [--json]");

  const block = parseJson(readInput(filePath));
  if (!block.blockHash) die("Input must be a Block object with blockHash, content, and parentHashes");

  const validation = validateBlock(block);
  if (!validation.ok) die("Block seal is broken — run alx block verify before anchoring");

  const rpcIdx = args.indexOf("--rpc-url");
  const keyIdx = args.indexOf("--private-key");
  const opts = {
    rpcUrl: rpcIdx !== -1 ? args[rpcIdx + 1] : undefined,
    privateKey: keyIdx !== -1 ? args[keyIdx + 1] : undefined,
  };

  if (!args.includes("--json")) {
    console.log(`\n${bold("Anchoring Block on Base")}\n`);
    info(`  Block:  ${block.blockHash.slice(0, 18)}...`);
    console.log();
  }

  const { anchorBlock } = await import("../lib/anchor.js");
  let result;
  try { result = await anchorBlock(block.blockHash, opts); }
  catch (err) { die(err.message); }

  if (args.includes("--json")) { json(result); }
  else {
    ok(`Block anchored`);
    info(`  Tx:     ${dim(result.txHash)}`);
    info(`  Hash:   ${result.blockHash.slice(0, 18)}...`);
    info(`  Time:   ${new Date(result.anchoredAt * 1000).toISOString()}`);
    console.log();
    console.log(dim(`  Verify: alx anchor status ${result.blockHash.slice(0, 18)}... --rpc-url <url>`));
    console.log();
  }
}

async function cmdAnchorBatch(args) {
  const bsIdx = args.indexOf("--hashes");
  const rawHashes = bsIdx !== -1 && args[bsIdx + 1]
    ? args[bsIdx + 1].split(",").map(h => h.trim()).filter(Boolean)
    : [];

  const { validateBlockHashBatch } = await import("../lib/block-workflow.js");
  const batchCheck = validateBlockHashBatch(rawHashes);
  if (!batchCheck.ok) die(batchCheck.issues.join("; "));

  const { anchorBatch, deriveBatchId } = await import("../lib/anchor.js");

  const batchIdx = args.indexOf("--batch-id");
  const batchId = batchIdx !== -1 ? args[batchIdx + 1] : deriveBatchId(rawHashes);

  const rpcIdx = args.indexOf("--rpc-url");
  const keyIdx = args.indexOf("--private-key");
  const opts = {
    rpcUrl: rpcIdx !== -1 ? args[rpcIdx + 1] : undefined,
    privateKey: keyIdx !== -1 ? args[keyIdx + 1] : undefined,
  };

  if (!args.includes("--json")) {
    console.log(`\n${bold("Anchoring hash batch on Base")}\n`);
    info(`  Hashes:  ${rawHashes.length}`);
    info(`  Set ID:  ${dim(batchId.slice(0, 18))}...`);
    console.log();
  }

  let result;
  try { result = await anchorBatch(batchId, rawHashes, opts); }
  catch (err) { die(err.message); }

  if (args.includes("--json")) { json(result); }
  else {
    ok(`Batch anchored`);
    info(`  Tx:       ${dim(result.txHash)}`);
    info(`  Set ID:   ${result.batchId.slice(0, 18)}...`);
    info(`  New:      ${result.count} hash(es) newly anchored`);
    info(`  Time:     ${new Date(result.anchoredAt * 1000).toISOString()}`);
    console.log();
  }
}

async function cmdAnchor(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "create") {
    if (rest.includes("--hashes")) return cmdAnchorBatch(rest);
    return cmdAnchorSingle(rest);
  }
  if (sub === "status") return cmdAnchorQuery(rest);
  die("Usage: alx anchor create <block.json> | alx anchor create --hashes <h1,h2,...> | alx anchor status <blockHash>");
}

async function cmdAnchorQuery(args) {
  const blockHash = args[0];
  if (!blockHash || blockHash.startsWith("--") || !/^0x[a-fA-F0-9]{64}$/.test(blockHash)) {
    die("Usage: alx anchor status <blockHash> [--rpc-url <url>] [--json]");
  }

  const rpcIdx = args.indexOf("--rpc-url");
  const opts = { rpcUrl: rpcIdx !== -1 ? args[rpcIdx + 1] : undefined };

  const { queryAnchor } = await import("../lib/anchor.js");

  let result;
  try { result = await queryAnchor(blockHash, opts); }
  catch (err) { die(err.message); }

  if (args.includes("--json")) {
    json(result);
  } else {
    console.log(`\n${bold("Anchor Query")}\n`);
    if (result.isAnchored) {
      ok(`Anchored ${green("on Base")}`);
      info(`  Hash:       ${result.blockHash.slice(0, 18)}...`);
      info(`  Anchored:   ${new Date(result.anchoredAt * 1000).toISOString()}`);
      info(`  Anchored by: ${dim(result.anchoredBy)}`);
    } else {
      fail(`${red("Not anchored")} — no on-chain record found`);
      info(`  Hash:   ${result.blockHash.slice(0, 18)}...`);
      info(dim("  Use: alx anchor <block.json> to anchor this Block"));
    }
    console.log();
    console.log(dim("  Use --json for machine-readable output"));
    console.log();
  }
}

function cmdVersion() {
  console.log(`\nalx v${ALX_VERSION} (protocol v${PROTOCOL_VERSION})\n`);
}

async function cmdDoctor(_args) {
  console.log(`\n${bold("alx doctor")} — environment check\n`);

  // Node version
  const [major] = process.versions.node.split(".").map(Number);
  const nodeOk = major >= 20 && major < 23;
  console.log(`  ${nodeOk ? green("✓") : red("✗")} Node ${process.versions.node}${nodeOk ? "" : "  (requires >=20 <23)"}`);

  // .env present
  const envPath = resolve(process.cwd(), ".env");
  const envExists = existsSync(envPath);
  console.log(`  ${envExists ? green("✓") : dim("–")} .env ${envExists ? "found" : "not found  (copy .env.example to get started)"}`);

  // IPFS
  const ipfs = ipfsEnvStatus();
  let ipfsOk = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${ipfs.endpoint}/api/v0/version`, { method: "POST", signal: ctrl.signal });
    clearTimeout(t);
    ipfsOk = res.ok;
  } catch { /* unreachable */ }
  console.log(`  ${ipfsOk ? green("✓") : dim("–")} IPFS ${ipfsOk ? `reachable at ${ipfs.endpoint}` : `not reachable at ${ipfs.endpoint}`}`);

  // S3
  const s3 = s3EnvStatus();
  const s3Configured = !!(s3.bucket && s3.accessKeyId && s3.secretAccessKey);
  console.log(`  ${s3Configured ? green("✓") : dim("–")} S3 ${s3Configured ? `bucket=${s3.bucket} region=${s3.region}` : "not configured  (ALX_S3_BUCKET / ALX_S3_ACCESS_KEY_ID missing)"}`);

  // Retrieval server
  const retrieval = retrievalEnvStatus();
  let retrievalOk = false;
  if (retrieval.endpoint) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${retrieval.endpoint}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      retrievalOk = res.ok;
    } catch { /* unreachable */ }
  }
  const retrievalLabel = retrieval.endpoint
    ? (retrievalOk ? `reachable at ${retrieval.endpoint}` : `not reachable at ${retrieval.endpoint}`)
    : "not configured  (ALX_RETRIEVAL_ENDPOINT missing)";
  console.log(`  ${retrievalOk ? green("✓") : dim("–")} Retrieval server ${retrievalLabel}`);

  // Optional Base anchor extension
  const {
    loadBaseMainnetConfig,
    resolveContractAddress,
    resolveContractNetwork,
    resolveNetwork,
    resolveRpcUrl,
  } = await import("../lib/base-contracts.js");
  const chainConfig = loadBaseMainnetConfig();
  const anchorNetworkId = resolveContractNetwork(chainConfig, "anchor");
  const anchorNetwork = resolveNetwork(chainConfig, anchorNetworkId);
  const rpcUrl = resolveRpcUrl(chainConfig, anchorNetworkId);
  const privateKey = process.env.ALX_DEPLOY_KEY;
  const anchorAddress = resolveContractAddress(chainConfig, "anchor");
  const readConfigured = Boolean(rpcUrl && anchorAddress);
  const writeConfigured = Boolean(readConfigured && privateKey);
  const anchorStatus = writeConfigured
    ? `ready for reads and writes on ${anchorNetworkId}`
    : readConfigured
      ? `ready for reads on ${anchorNetworkId}; ALX_DEPLOY_KEY not set`
      : `not configured  (${anchorNetwork?.rpcUrlEnv || "RPC URL"} / ALX_ANCHOR_ADDRESS missing)`;
  console.log(`  ${readConfigured ? green("✓") : dim("–")} Base/EVM ${anchorStatus}`);
  // Content types
  const types = knownContentTypes();
  console.log(`  ${green("✓")} ${types.length} known content types  ${dim("(alx block types for full list)")}`);

  console.log();
  console.log(dim("  Configure providers: alx init --provider s3|ipfs|retrieval"));
  console.log(dim("  Full env reference:  .env.example"));
  console.log();
}

function usage() {
  console.log(`
${bold("alx")} — ALX Protocol CLI v${ALX_VERSION}

${bold("Commands:")}
  alx init [dir]                 Create a minimal starter project with example blocks
  alx init --provider <s3|ipfs|retrieval>
                                 Write storage provider config stubs to .env
  alx doctor                     Check environment: Node version, .env, IPFS, S3, retrieval server
  alx version                    Show version info

${bold("block")}
  alx block create <file> [--parent <reference>] [--parents <references>] [--dry-run]
                                 Create and locally persist a Block from JSON or UTF-8 text
  alx block create --from-ipfs <cid> [--out file]
                                 Fetch a CID via IPFS gateway and lock into a block
  alx block create --from-s3 <s3://bucket/key> [--out file]
                                 Fetch an S3 object and lock into a block
  alx block create --from-url <url> [--out file]
                                 Fetch any HTTP URL and lock into a block
  alx block link [<content.json>] <parent>[,...] [out.block.json] [--dry-run]
                                 Parent: file, 0x hash, @last, @latest, or @parent
  alx block show <reference>     Print a Block by hash, prefix, @last, or file
  alx block verify <reference>   Verify a Block by hash, prefix, @last, or file
  alx block inspect <file>       Explain a block field-by-field
  alx block proof <file>         Show cryptographic proof walkthrough
  alx block publish <file> [--ipfs <endpoint>] [--endpoint <url>] [--api-key <key>] [--cid-map <path>]
                                 Pin to IPFS and/or publish to a retrieval server
  alx block resolve <blockHash> [--endpoint <url>] [--gateway <url>] [--cid-map <path>]
                                 Fetch and verify a Block from HTTP, IPFS, or a local mapping
  alx block list [--recent N|--all] [--json]
                                 List recent or all indexed project Blocks
  alx block types [--json]       List known advisory content type schemas

${bold("graph")}
  alx graph verify <file>        Verify all block hashes in a graph (cryptographic)
  alx graph trace <hash> --file <f>
                                 Trace attribution through a derivation graph

${bold("anchor")}
  alx anchor create <file> [--rpc-url <url>] [--private-key <key>]
                                 Anchor a block's blockHash on Base (ALXAnchor)
  alx anchor create --hashes <h1,h2,...> [--batch-id <id>] [--rpc-url <url>] [--private-key <key>]
                                 Anchor a hash batch (2+ hashes) on Base
  alx anchor status <blockHash> [--rpc-url <url>]
                                 Query on-chain anchor status for a blockHash

${bold("server / retrieval")}
  alx server start [--port 8080] Start verification API server
  alx retrieval start [--port 8081] [--data-dir <path>]
                                 Start block retrieval API server (shared team store)

${bold("test / conformance")}
  alx test run <tests> --against <v>
                                 Run acceptance tests from a locked tests block
  alx test-vectors run           Run hash test vectors (self-test)
  alx conformance run            Run protocol conformance suite
  alx conformance run --impl <c> Test an external implementation
  alx extension-conformance merkle
                                 Run optional Merkle extension tests
  alx extension-conformance signing
                                 Run optional signing extension tests

${bold("Examples:")}
  alx block verify protocol/graph.json
  alx block inspect protocol/07-generated-validator.block.json
  alx test run protocol/06-validator-tests.block.json --against protocol/07-generated-validator.block.json
  alx graph trace 0xabc... --file protocol/graph.json
  alx test-vectors run
  alx server start --port 8080
  alx retrieval start --port 8081
  alx block publish research.block.json --endpoint http://localhost:8081
  alx block resolve 0xabc... --endpoint http://localhost:8081
  alx anchor create research.block.json --rpc-url https://sepolia.base.org
  alx anchor create --hashes 0xaaa...,0xbbb... --batch-id 0xccc... --rpc-url https://sepolia.base.org
  alx anchor status 0xabc... --rpc-url https://sepolia.base.org --json

${bold("Machine-readable:")}
  alx block create --content '{"x":1}' --json
  alx block create --content-file ./data.json --out new.block.json
  alx block create ./data.json --parent '@last'
  alx block create ./merge.json --parent 0xabc... --parent 0xdef...
  alx block create --content-file ./data.json --dry-run
  alx block create --from-ipfs bafybei... --out imported.block.json
  alx block create --from-s3 s3://my-bucket/report.pdf --out report.block.json
  alx block create --from-url https://api.example.com/data.json --out data.block.json
  alx block link ./ai-response.json research.block.json synthesis.block.json
  alx block link ./data.json @latest child.block.json
  alx block link ./data.json @latest out.block.json --dry-run --json
  alx block list --recent 5
  alx block list --all --json
  cat content.json | alx block link --parent parent.block.json --out child.block.json
  alx graph trace 0xabc... --file graph.json --json

${dim(`Protocol spec: protocol/spec.md`)}
`);
}

// ── Router ──

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  usage();
  process.exit(0);
}

const cmd = args[0];
const rest = args.slice(1);

switch (cmd) {
  case "init":         cmdInit(rest); break;
  case "block":        await cmdBlock(rest); break;
  case "graph":        await cmdGraph(rest); break;
  case "anchor":       await cmdAnchor(rest); break;
  case "server":       await cmdServer(rest); break;
  case "retrieval":
    if (rest[0] === "start") await cmdRetrievalServe(rest.slice(1));
    else die(`Unknown: alx retrieval ${rest[0]}. Use: alx retrieval start`);
    break;
  case "test":         await cmdTestRouter(rest); break;
  case "test-vectors": await cmdTestVectors(rest); break;
  case "conformance":  await cmdConformance(rest); break;
  case "extension-conformance": await cmdExtensionConformance(rest); break;
  case "doctor":       await cmdDoctor(rest); break;
  case "version":      cmdVersion(); break;
  default:             die(`Unknown command: ${cmd}. Run 'alx --help' for usage.`);
}
