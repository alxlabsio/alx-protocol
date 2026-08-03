import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  ALX_VERSION,
  PROTOCOL_VERSION,
  buildGraph,
  canonicalizeProtocolJson,
  createBlock,
  deriveContentHash,
  validateBlock,
  validateGraph,
} from "../lib/cli-context.js";
import {
  appendBlockToGraph,
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
import {
  parseBlockCreateArgs,
  parseBlockLinkArgs,
  parseParentReferences,
} from "../lib/cli-args.js";
import {
  listAllFromState,
  listRecentFromState,
  persistBlockWrite,
} from "../lib/cli-state.js";
import {
  checkContentType,
  CONTENT_TYPE_SCHEMAS,
} from "../lib/content-types.js";
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
import { cmdProof } from "./proof-test.js";
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

function cmdInspect(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--"))
    die("Usage: alx block inspect <file>");

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
  console.log(
    `  ${bold(pad("contentHash"))}  ${block.contentHash || deriveContentHash(block.content)}`,
  );
  console.log(
    `  ${bold(pad("parentHashes"))}  ${(block.parentHashes || []).length === 0 ? "(none — this is a root block)" : ""}`,
  );
  for (const p of block.parentHashes || []) {
    console.log(`  ${"".padEnd(16)}    ${dim(p)}`);
  }
  console.log(
    `  ${bold(pad("content"))}  ${typeof block.content === "object" ? JSON.stringify(block.content) : String(block.content)}`,
  );
  console.log();
  console.log(`  ${bold(pad("Canonical form"))}  ${canonical.length} bytes`);
  console.log(
    `  ${bold(pad("Content canonical"))}  ${contentCanonical.length} bytes`,
  );
  console.log(
    `  ${bold(pad("Integrity"))}  ${result.ok ? green("VALID — hash matches content + parents") : red("INVALID — hash does not match")}`,
  );
  console.log(`  ${bold(pad("Protocol"))}  v${PROTOCOL_VERSION}`);
  console.log();
}

function printBlockCreated(
  block,
  { storedPath, outPath, graphPath, label = "Block created" },
) {
  console.log();
  ok(label);
  console.log(`  ${bold("blockHash")}    ${block.blockHash}`);
  console.log(`  ${bold("contentHash")} ${block.contentHash}`);
  console.log(`  ${bold("parents")}      ${block.parentHashes.length}`);
  if (storedPath) console.log(`  ${bold("stored")}       ${storedPath}`);
  if (outPath && outPath !== storedPath)
    console.log(`  ${bold("copied")}       ${outPath}`);
  if (graphPath)
    console.log(`  ${bold("graph")}        appended to ${graphPath}`);
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
    const graphPath =
      args.indexOf("--append-graph") !== -1
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
    json(
      Object.entries(CONTENT_TYPE_SCHEMAS).map(([type, schema]) => ({
        type,
        ...schema,
      })),
    );
    return;
  }
  console.log(`\n${bold("Known content types")}\n`);
  for (const [type, schema] of Object.entries(CONTENT_TYPE_SCHEMAS)) {
    console.log(`  ${bold(type)}`);
    console.log(`  ${dim(schema.description)}`);
    if (schema.required?.length)
      console.log(`    required: ${schema.required.join(", ")}`);
    if (schema.oneOf?.length)
      console.log(
        `    one of:  ${schema.oneOf.map((g) => g.join("+")).join(" | ")}`,
      );
    if (schema.optional?.length)
      console.log(`    optional: ${dim(schema.optional.join(", "))}`);
    console.log();
  }
  console.log(
    dim(
      "  The protocol does not enforce content shape. These are advisory schemas.",
    ),
  );
  console.log();
}

export async function cmdBlock(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "create") return await cmdBlockCreate(rest);
  if (sub === "link") return cmdBlockLink(rest);
  if (sub === "list") return cmdBlockList(rest);
  if (sub === "show") return cmdBlockShow(rest);
  if (sub === "types") return cmdBlockTypes(rest);
  if (sub === "verify") return cmdBlockVerify(rest);
  if (sub === "inspect") return cmdInspect(rest);
  if (sub === "proof") return cmdProof(rest);
  if (sub === "publish") return await cmdPublish(rest);
  if (sub === "resolve") return await cmdResolve(rest);
  die(
    "Usage: alx block create | link | show | list | types | verify | inspect | proof | publish | resolve",
  );
}
