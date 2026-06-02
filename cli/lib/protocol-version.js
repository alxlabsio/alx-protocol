import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./repo-root.js";

/** Canonical protocol version from `protocol/VERSION`. */
export function readProtocolVersion() {
  try {
    return readFileSync(resolve(REPO_ROOT, "protocol/VERSION"), "utf-8").trim();
  } catch {
    return "1";
  }
}
