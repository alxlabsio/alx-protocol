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
} from "../lib/cli-utils.js";

export async function cmdResolve(args) {
  const blockHash = args[0];
  if (
    !blockHash ||
    blockHash.startsWith("--") ||
    !/^0x[a-fA-F0-9]{64}$/.test(blockHash)
  ) {
    die(
      "Usage: alx block resolve <blockHash> [--cid-map <path>] [--gateway <url>] [--endpoint <url>] [--json]",
    );
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
    info(
      dim(
        "  Publish with: alx block publish <block.json> --endpoint <retrieval-url>",
      ),
    );
    info(
      dim("  Or pin locally: alx block publish <block.json> --ipfs <endpoint>"),
    );
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

export async function cmdPublish(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--")) {
    die(
      "Usage: alx block publish <block.json> [--ipfs <endpoint>] [--endpoint <url>] [--api-key <key>] [--cid-map <path>] [--json]",
    );
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
  const gatewayUrl =
    gatewayIdx !== -1 ? args[gatewayIdx + 1] : "https://ipfs.io/ipfs";
  const apiKeyIdx = args.indexOf("--api-key");
  const apiKey =
    apiKeyIdx !== -1 ? args[apiKeyIdx + 1] : process.env.ALX_RETRIEVAL_API_KEY;

  const block = parseJson(readInput(filePath));
  if (!block.blockHash)
    die(
      "Input must be a Block object with blockHash, content, and parentHashes",
    );

  const validation = validateBlock(block);
  if (!validation.ok)
    die("Block seal is broken — run alx block verify to see the diff");

  const { publishToIpfs, recordCidMapping, publishToRetrievalEndpoint } =
    await import("../lib/resolve.js");

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
      await publishToRetrievalEndpoint(block, retrievalEndpoint, {
        cid,
        apiKey,
      });
    } catch (err) {
      die(err.message);
    }
  }

  const output = {
    blockHash: block.blockHash,
    ...(cid
      ? { cid, gatewayUrl: `${gatewayUrl.replace(/\/$/, "")}/${cid}` }
      : {}),
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
    console.log(
      dim(
        `  Resolve later with: alx block resolve ${block.blockHash.slice(0, 18)}...`,
      ),
    );
    if (retrievalEndpoint) {
      console.log(
        dim(
          `  Team resolve:       alx block resolve ${block.blockHash.slice(0, 18)}... --endpoint ${retrievalEndpoint}`,
        ),
      );
    }
    console.log();
  }
}
