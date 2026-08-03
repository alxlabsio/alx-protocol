import { validateBlock } from "../lib/cli-context.js";
import {
  bold,
  die,
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

async function cmdAnchorSingle(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--"))
    die(
      "Usage: alx anchor create <block.json> [--rpc-url <url>] [--private-key <key>] [--json]",
    );

  const block = parseJson(readInput(filePath));
  if (!block.blockHash)
    die(
      "Input must be a Block object with blockHash, content, and parentHashes",
    );

  const validation = validateBlock(block);
  if (!validation.ok)
    die("Block seal is broken — run alx block verify before anchoring");

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
  try {
    result = await anchorBlock(block.blockHash, opts);
  } catch (err) {
    die(err.message);
  }

  if (args.includes("--json")) {
    json(result);
  } else {
    ok(`Block anchored`);
    info(`  Tx:     ${dim(result.txHash)}`);
    info(`  Hash:   ${result.blockHash.slice(0, 18)}...`);
    info(`  Time:   ${new Date(result.anchoredAt * 1000).toISOString()}`);
    console.log();
    console.log(
      dim(
        `  Verify: alx anchor status ${result.blockHash.slice(0, 18)}... --rpc-url <url>`,
      ),
    );
    console.log();
  }
}

async function cmdAnchorBatch(args) {
  const bsIdx = args.indexOf("--hashes");
  const rawHashes =
    bsIdx !== -1 && args[bsIdx + 1]
      ? args[bsIdx + 1]
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean)
      : [];

  const { validateBlockHashBatch } = await import("../lib/block-workflow.js");
  const batchCheck = validateBlockHashBatch(rawHashes);
  if (!batchCheck.ok) die(batchCheck.issues.join("; "));

  const { anchorBatch, deriveBatchId } = await import("../lib/anchor.js");

  const batchIdx = args.indexOf("--batch-id");
  const batchId =
    batchIdx !== -1 ? args[batchIdx + 1] : deriveBatchId(rawHashes);

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
  try {
    result = await anchorBatch(batchId, rawHashes, opts);
  } catch (err) {
    die(err.message);
  }

  if (args.includes("--json")) {
    json(result);
  } else {
    ok(`Batch anchored`);
    info(`  Tx:       ${dim(result.txHash)}`);
    info(`  Set ID:   ${result.batchId.slice(0, 18)}...`);
    info(`  New:      ${result.count} hash(es) newly anchored`);
    info(`  Time:     ${new Date(result.anchoredAt * 1000).toISOString()}`);
    console.log();
  }
}

export async function cmdAnchor(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "create") {
    if (rest.includes("--hashes")) return cmdAnchorBatch(rest);
    return cmdAnchorSingle(rest);
  }
  if (sub === "status") return cmdAnchorQuery(rest);
  die(
    "Usage: alx anchor create <block.json> | alx anchor create --hashes <h1,h2,...> | alx anchor status <blockHash>",
  );
}

async function cmdAnchorQuery(args) {
  const blockHash = args[0];
  if (
    !blockHash ||
    blockHash.startsWith("--") ||
    !/^0x[a-fA-F0-9]{64}$/.test(blockHash)
  ) {
    die("Usage: alx anchor status <blockHash> [--rpc-url <url>] [--json]");
  }

  const rpcIdx = args.indexOf("--rpc-url");
  const opts = { rpcUrl: rpcIdx !== -1 ? args[rpcIdx + 1] : undefined };

  const { queryAnchor } = await import("../lib/anchor.js");

  let result;
  try {
    result = await queryAnchor(blockHash, opts);
  } catch (err) {
    die(err.message);
  }

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
