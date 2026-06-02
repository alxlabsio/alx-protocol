import { createHash } from "node:crypto";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

function encodeBase32(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/** CIDv1 raw codec with SHA-256 over exact file bytes (matches canonical package manifests). */
export function cidV1RawSha256(bytes) {
  const digest = createHash("sha256").update(bytes).digest();
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), digest]);
  const cidBytes = Buffer.concat([Buffer.from([0x01]), Buffer.from([0x55]), multihash]);
  return `b${encodeBase32(cidBytes)}`;
}

export function parseCidString(cid) {
  if (typeof cid !== "string" || cid.length < 2 || !cid.startsWith("b")) {
    throw new Error("invalid_cid");
  }
  return cid;
}
