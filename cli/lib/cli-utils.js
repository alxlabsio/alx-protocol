import { existsSync, readFileSync } from "node:fs";
import { parseStrictJson } from "./strict-json.js";

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
    return decodeInput(readFileSync(pathOrArgs)).trim();
  }
  const args = pathOrArgs;
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return decodeInput(readFileSync(args[fileIdx + 1])).trim();
  }
  if (args[0] && !args[0].startsWith("--") && existsSync(args[0])) {
    return decodeInput(readFileSync(args[0])).trim();
  }
  try {
    return decodeInput(readFileSync(0)).trim();
  } catch {
    die("No input provided. Pass a file path or pipe JSON via stdin.");
  }
}

function decodeInput(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    die("Input is not valid UTF-8");
  }
}

export function parseJson(str) {
  try {
    return parseStrictJson(str);
  } catch {
    die(`Invalid JSON: ${str.slice(0, 80)}${str.length > 80 ? "..." : ""}`);
  }
}
