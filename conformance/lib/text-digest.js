import { createHash } from "node:crypto";

export function normalizeLfText(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  return text.replace(/\r\n/gu, "\n");
}

export function sha256Text(value) {
  return createHash("sha256").update(normalizeLfText(value), "utf8").digest("hex");
}
