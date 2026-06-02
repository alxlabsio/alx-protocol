import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const green = (s) => `\x1b[32m${s}\x1b[0m`;
export const red = (s) => `\x1b[31m${s}\x1b[0m`;
export const dim = (s) => `\x1b[2m${s}\x1b[0m`;
export const bold = (s) => `\x1b[1m${s}\x1b[0m`;
export const ok = (msg) => console.log(`  ${green("\u2713")} ${msg}`);
export const fail = (msg) => console.log(`  ${red("\u2717")} ${msg}`);
export const info = (msg) => console.log(`  ${msg}`);

export function json(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function die(msg) {
  console.error(`\n${red("error:")} ${msg}`);
  process.exit(1);
}

export function dieJson(msg) {
  console.log(JSON.stringify({ ok: false, error: msg instanceof Error ? msg.message : String(msg) }, null, 2));
  process.exit(1);
}

export function readInput(pathOrArgs) {
  if (typeof pathOrArgs === "string") {
    if (!existsSync(pathOrArgs)) die(`File not found: ${pathOrArgs}`);
    return readFileSync(pathOrArgs, "utf-8").trim();
  }
  const args = pathOrArgs;
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return readFileSync(args[fileIdx + 1], "utf-8").trim();
  }
  if (args[0] && !args[0].startsWith("--") && existsSync(args[0])) {
    return readFileSync(args[0], "utf-8").trim();
  }
  try {
    return readFileSync(0, "utf-8").trim();
  } catch {
    die("No input provided. Pass a file path or pipe JSON via stdin.");
  }
}

export function parseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    die(`Invalid JSON: ${str.slice(0, 80)}${str.length > 80 ? "..." : ""}`);
  }
}

export function writeBlockJson(filePath, block) {
  writeFileSync(filePath, JSON.stringify(block, null, 2) + "\n");
}

export function appendBlockToGraph(graphPath, block) {
  let graph = [];
  if (existsSync(graphPath)) {
    const raw = readFileSync(graphPath, "utf-8").trim();
    if (raw) {
      const data = parseJson(raw);
      if (!Array.isArray(data)) die(`Graph file must be a JSON array: ${graphPath}`);
      graph = data;
    }
  }
  const hash = block.blockHash?.toLowerCase();
  if (graph.some((entry) => entry.blockHash?.toLowerCase() === hash)) {
    die(`Block already present in graph: ${block.blockHash}`);
  }
  graph.push(block);
  writeBlockJson(graphPath, graph);
}
