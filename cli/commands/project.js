import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { ALX_VERSION, PROTOCOL_VERSION } from "../lib/cli-context.js";
import { bold, dim, green, red } from "../lib/cli-utils.js";
import {
  ipfsEnvStatus,
  retrievalEnvStatus,
  s3EnvStatus,
} from "../lib/storage-providers.js";

export function cmdVersion() {
  console.log(`\nalx v${ALX_VERSION} (protocol v${PROTOCOL_VERSION})\n`);
}

export async function cmdDoctor(_args) {
  console.log(`\n${bold("alx doctor")} — environment check\n`);

  const [major] = process.versions.node.split(".").map(Number);
  const nodeOk = major >= 20 && major < 23;
  console.log(
    `  ${nodeOk ? green("✓") : red("✗")} Node ${process.versions.node}${nodeOk ? "" : "  (requires >=20 <23)"}`,
  );

  const envPath = resolve(process.cwd(), ".env");
  const envExists = existsSync(envPath);
  console.log(
    `  ${envExists ? green("✓") : dim("–")} .env ${envExists ? "found" : "not found  (copy .env.example to configure optional services)"}`,
  );

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

  const s3 = s3EnvStatus();
  const s3Configured = !!(s3.bucket && s3.accessKeyId && s3.secretAccessKey);
  console.log(
    `  ${s3Configured ? green("✓") : dim("–")} S3 ${s3Configured ? `bucket=${s3.bucket} region=${s3.region}` : "not configured  (ALX_S3_BUCKET / ALX_S3_ACCESS_KEY_ID missing)"}`,
  );

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
  const anchorAddressEnv = chainConfig.contracts?.anchor?.deployments?.[anchorNetworkId]?.addressEnv;
  const readConfigured = Boolean(rpcUrl && anchorAddress);
  const writeConfigured = Boolean(readConfigured && privateKey);
  const anchorStatus = writeConfigured
    ? `ready for reads and writes on ${anchorNetworkId}`
    : readConfigured
      ? `ready for reads on ${anchorNetworkId}; ALX_DEPLOY_KEY not set`
      : `not configured  (${anchorNetwork?.rpcUrlEnv || "RPC URL"} / ${anchorAddressEnv || "ALX_ANCHOR_ADDRESS"} missing)`;
  console.log(
    `  ${readConfigured ? green("✓") : dim("–")} Base/EVM ${anchorStatus}`,
  );

  console.log();
  console.log(dim("  Full env reference:  .env.example"));
  console.log();
}
