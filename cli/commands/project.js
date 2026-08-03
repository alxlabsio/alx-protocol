import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  ALX_VERSION,
  PROTOCOL_VERSION,
  createBlock,
} from "../lib/cli-context.js";
import { bold, die, dim, green, info, ok, red } from "../lib/cli-utils.js";
import { persistBlockWrite } from "../lib/cli-state.js";
import { knownContentTypes } from "../lib/content-types.js";
import {
  ipfsEnvStatus,
  retrievalEnvStatus,
  s3EnvStatus,
} from "../lib/storage-providers.js";

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

export function cmdInit(args) {
  // alx init --provider <s3|ipfs|retrieval>
  const providerIdx = args.indexOf("--provider");
  if (providerIdx !== -1) {
    const provider = args[providerIdx + 1];
    if (!provider || !PROVIDER_ENV_STUBS[provider]) {
      die(
        `Unknown provider: ${provider || "(none)"}. Choose: s3, ipfs, retrieval`,
      );
    }
    const envPath = resolve(process.cwd(), ".env");
    const stub = PROVIDER_ENV_STUBS[provider];
    if (existsSync(envPath)) {
      const existing = readFileSync(envPath, "utf-8");
      if (existing.includes(`ALX_${provider.toUpperCase()}`)) {
        info(
          `  .env already contains ${provider.toUpperCase()} config — not overwriting`,
        );
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
    [],
  );
  const synthesis = createBlock(
    {
      type: "ai.response",
      text: "Market analysis shows growth in AI infrastructure",
    },
    [research.blockHash],
  );
  const decision = createBlock(
    { type: "decision", text: "Proceed with AI infrastructure investment" },
    [research.blockHash, synthesis.blockHash],
  );

  persistBlockWrite({
    block: research,
    outPath: join(target, "research.block.json"),
    cwd: target,
  });
  ok("Created research.block.json (root block)");

  persistBlockWrite({
    block: synthesis,
    outPath: join(target, "synthesis.block.json"),
    cwd: target,
  });
  ok(`Created synthesis.block.json (parent: research)`);

  persistBlockWrite({
    block: decision,
    outPath: join(target, "decision.block.json"),
    cwd: target,
  });
  ok(`Created decision.block.json (parents: research + synthesis)`);

  writeFileSync(join(target, ".gitignore"), ".alx/\n");

  const graph = [research, synthesis, decision];
  writeFileSync(
    join(target, "graph.json"),
    JSON.stringify(graph, null, 2) + "\n",
  );
  ok("Created graph.json (full DAG)");

  // Create a tampered block to demonstrate validation rejection
  const tampered = {
    ...research,
    content: { type: "tampered", text: "this won't validate" },
  };
  writeFileSync(
    join(target, "tampered.block.json"),
    JSON.stringify(tampered, null, 2) + "\n",
  );
  ok("Created tampered.block.json (invalid — for testing)");

  console.log(`\n${bold("Next steps:")}\n`);
  console.log(`  cd ${dir}`);
  console.log(`  alx block verify research.block.json`);
  console.log(`  alx block verify tampered.block.json`);
  console.log(`  alx block inspect decision.block.json`);
  console.log(
    `  alx graph trace ${decision.blockHash.slice(0, 18)}... --file graph.json`,
  );
  console.log(`  alx test-vectors run`);
  console.log();
}

export function cmdVersion() {
  console.log(`\nalx v${ALX_VERSION} (protocol v${PROTOCOL_VERSION})\n`);
}

export async function cmdDoctor(_args) {
  console.log(`\n${bold("alx doctor")} — environment check\n`);

  // Node version
  const [major] = process.versions.node.split(".").map(Number);
  const nodeOk = major >= 20 && major < 23;
  console.log(
    `  ${nodeOk ? green("✓") : red("✗")} Node ${process.versions.node}${nodeOk ? "" : "  (requires >=20 <23)"}`,
  );

  // .env present
  const envPath = resolve(process.cwd(), ".env");
  const envExists = existsSync(envPath);
  console.log(
    `  ${envExists ? green("✓") : dim("–")} .env ${envExists ? "found" : "not found  (copy .env.example to get started)"}`,
  );

  // IPFS
  const ipfs = ipfsEnvStatus();
  let ipfsOk = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${ipfs.endpoint}/api/v0/version`, {
      method: "POST",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    ipfsOk = res.ok;
  } catch {
    /* unreachable */
  }
  console.log(
    `  ${ipfsOk ? green("✓") : dim("–")} IPFS ${ipfsOk ? `reachable at ${ipfs.endpoint}` : `not reachable at ${ipfs.endpoint}`}`,
  );

  // S3
  const s3 = s3EnvStatus();
  const s3Configured = !!(s3.bucket && s3.accessKeyId && s3.secretAccessKey);
  console.log(
    `  ${s3Configured ? green("✓") : dim("–")} S3 ${s3Configured ? `bucket=${s3.bucket} region=${s3.region}` : "not configured  (ALX_S3_BUCKET / ALX_S3_ACCESS_KEY_ID missing)"}`,
  );

  // Retrieval server
  const retrieval = retrievalEnvStatus();
  let retrievalOk = false;
  if (retrieval.endpoint) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${retrieval.endpoint}/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      retrievalOk = res.ok;
    } catch {
      /* unreachable */
    }
  }
  const retrievalLabel = retrieval.endpoint
    ? retrievalOk
      ? `reachable at ${retrieval.endpoint}`
      : `not reachable at ${retrieval.endpoint}`
    : "not configured  (ALX_RETRIEVAL_ENDPOINT missing)";
  console.log(
    `  ${retrievalOk ? green("✓") : dim("–")} Retrieval server ${retrievalLabel}`,
  );

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
  console.log(
    `  ${readConfigured ? green("✓") : dim("–")} Base/EVM ${anchorStatus}`,
  );
  // Content types
  const types = knownContentTypes();
  console.log(
    `  ${green("✓")} ${types.length} known content types  ${dim("(alx block types for full list)")}`,
  );

  console.log();
  console.log(
    dim("  Configure providers: alx init --provider s3|ipfs|retrieval"),
  );
  console.log(dim("  Full env reference:  .env.example"));
  console.log();
}
