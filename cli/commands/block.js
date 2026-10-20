import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  ALX_VERSION,
  PROTOCOL_VERSION,
  buildGraph,
  createBlock,
  deriveContentHash,
  validateBlock,
  validateGraph,
} from "../lib/cli-context.js";
import {
  bold,
  die,
  dieJson,
  dim,
  fail,
  green,
  info,
  json,
  ok,
  parseJson,
  readInput,
  red,
} from "../lib/cli-utils.js";
import { parseBlockCreateArgs, parseParentReferences } from "../lib/cli-args.js";
import { parseStrictJsonBytes } from "../lib/strict-json.js";
import {
  listAllFromState,
  listRecentFromState,
  persistBlockWrite,
} from "../lib/cli-state.js";
import {
  findBlockJsonFilesInCwd,
  resolveBlockReferenceToPath,
  resolveParentTokensToHashes,
} from "../lib/parent-resolve.js";
import {
  fetchFromIpfs,
  fetchFromS3,
  fetchFromUrl,
} from "../lib/storage-providers.js";
import { cmdPublish, cmdResolve } from "./storage.js";

export function cmdValidate(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--"))
    die("Usage: alx block verify <reference> | alx graph verify <file>");

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
      ok(
        `DAG structure valid (${graphResult.blocks} blocks, ${graphResult.edges} edges)`,
      );
    } else {
      fail(`DAG structure issues: ${graphResult.issues.length} problem(s)`);
      allOk = false;
    }

    ok(dim(`alx-protocol TypeScript v${ALX_VERSION}`));
    console.log();
    process.exit(allOk ? 0 : 1);
  } else {
    // Single block
    if (!data.blockHash)
      die(
        "Input must be a Block object with blockHash, content, and parentHashes",
      );
    const result = validateBlock(data);
    if (result.ok) {
      ok(`Block is ${green("valid")}`);
      info(`  Hash:          ${data.blockHash}`);
      info(
        `  Content hash:  ${data.contentHash || deriveContentHash(data.content)}`,
      );
      info(`  Parents:       ${(data.parentHashes || []).length}`);
      info(`  Protocol:      v${PROTOCOL_VERSION}`);
    } else {
      fail(`Block is ${red("INVALID")}`);
      info(`  expected hash: ${result.expected}`);
      info(`  actual hash:   ${result.actual}`);
      info(
        `  Content or parentHashes have been modified after block creation.`,
      );
    }
    console.log();
    process.exit(result.ok ? 0 : 1);
  }
}

function printBlockCreated(
  block,
  { storedPath, outPath, label = "Block created" },
) {
  console.log();
  ok(label);
  console.log(`  ${bold("blockHash")}    ${block.blockHash}`);
  console.log(`  ${bold("contentHash")} ${block.contentHash}`);
  console.log(`  ${bold("parents")}      ${block.parentHashes.length}`);
  if (storedPath) console.log(`  ${bold("stored")}       ${storedPath}`);
  if (outPath && outPath !== storedPath)
    console.log(`  ${bold("copied")}       ${outPath}`);
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

  for (const removedOption of [
    "--parents",
    "--validate-parents",
    "--append-graph",
  ]) {
    if (args.includes(removedOption)) {
      dieInput(new Error(`Unknown option: ${removedOption}`), useJson);
      return;
    }
  }

  // ── --from-* fetch shortcuts ──────────────────────────────────────────────
  const fromIpfsIdx = args.indexOf("--from-ipfs");
  const fromS3Idx = args.indexOf("--from-s3");
  const fromUrlIdx = args.indexOf("--from-url");
  let fetchedContent = null;

  if (fromIpfsIdx !== -1) {
    const cid = args[fromIpfsIdx + 1];
    if (!cid || cid.startsWith("--"))
      dieInput(new Error("--from-ipfs requires a CID"), useJson);
    try {
      fetchedContent = await fetchFromIpfs(cid);
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  } else if (fromS3Idx !== -1) {
    const uri = args[fromS3Idx + 1];
    if (!uri || uri.startsWith("--"))
      dieInput(new Error("--from-s3 requires an s3://bucket/key URI"), useJson);
    try {
      fetchedContent = await fetchFromS3(uri);
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  } else if (fromUrlIdx !== -1) {
    const url = args[fromUrlIdx + 1];
    if (!url || url.startsWith("--"))
      dieInput(new Error("--from-url requires a URL"), useJson);
    try {
      fetchedContent = await fetchFromUrl(url);
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  }

  let parsed;
  if (fetchedContent) {
    // Synthetic parsed result — content comes from the fetch, not arg parsing
    const outIdx = args.indexOf("--out");
    const outPath =
      outIdx !== -1 ? resolve(process.cwd(), args[outIdx + 1]) : null;
    parsed = {
      content: fetchedContent,
      contentSource: "fetch",
      parents: parseParentReferences(args),
      outPath,
      json: useJson,
      dryRun: args.includes("--dry-run"),
      verifyParents: args.includes("--verify-parents"),
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
        validateSeal: parsed.verifyParents ? validateBlock : undefined,
      });
    } catch (err) {
      dieInput(err, useJson);
      return;
    }
  }

  let block;
  try {
    block = createBlock(parsed.content, parentHashes);
  } catch (err) {
    dieInput(err, useJson);
    return;
  }

  let persisted = null;
  if (!parsed.dryRun) {
    try {
      persisted = persistBlockWrite({ block, outPath: parsed.outPath });
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
      label: parsed.dryRun ? "Block (dry-run)" : "Block created",
    });
    if (parsed.dryRun) {
      console.log(
        dim(
          "  --dry-run: hashes computed, no files written, state not updated",
        ),
      );
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
    if (!Number.isFinite(n) || n < 1)
      die("--recent requires a positive number");
    limit = n;
  }

  const cwd = process.cwd();
  const fromState = showAll
    ? listAllFromState(cwd)
    : listRecentFromState(cwd, limit);
  const seen = new Set(fromState.map((r) => r.blockHash));
  const diskFiles = findBlockJsonFilesInCwd(cwd);

  const rows = fromState.map((entry) => {
    const availablePath = [entry.path, ...(entry.outputPaths ?? [])].find(
      (path) => path && existsSync(path),
    );
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
      const block = parseStrictJsonBytes(readFileSync(file));
      if (!validateBlock(block).ok) continue;
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

  console.log(
    `\n${bold(showAll ? "All Indexed Blocks" : "Recent Blocks")} (${cwd})\n`,
  );
  if (rows.length === 0) {
    info("  No blocks in .alx/state.json or *.block.json in this directory.");
    info(
      "  Create one: alx block create --content-file ./data.json --out research.block.json",
    );
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
  console.log(dim("  Parent shorthand: @last"));
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

export async function cmdBlock(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "create") return await cmdBlockCreate(rest);
  if (sub === "list") return cmdBlockList(rest);
  if (sub === "show") return cmdBlockShow(rest);
  if (sub === "verify") return cmdBlockVerify(rest);
  if (sub === "publish") return await cmdPublish(rest);
  if (sub === "resolve") return await cmdResolve(rest);
  die(
    "Usage: alx block create | show | verify | list | publish | resolve",
  );
}
