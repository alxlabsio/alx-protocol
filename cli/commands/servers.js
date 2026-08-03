import { resolve } from "node:path";

import { die } from "../lib/cli-utils.js";
import { startRetrievalServer } from "../server/retrieval-server.js";
import { startServer } from "../server/server.js";

async function cmdServe(args) {
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 8080;
  await startServer(port);
}

export async function cmdServer(args) {
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
  const dataDir =
    dataDirIdx !== -1
      ? resolve(process.cwd(), args[dataDirIdx + 1])
      : undefined;
  const gateway = gatewayIdx !== -1 ? args[gatewayIdx + 1] : undefined;
  await startRetrievalServer(port, { dataDir, gateway });
}

export async function cmdRetrieval(args) {
  if (args[0] === "start") return cmdRetrievalServe(args.slice(1));
  die(`Unknown: alx retrieval ${args[0]}. Use: alx retrieval start`);
}
