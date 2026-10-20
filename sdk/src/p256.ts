/**
 * p256.ts — P-256 (secp256r1) implementation of the Signer/Verifier interfaces.
 *
 * P-256 is the NIST standard curve used by WebAuthn, Apple Secure Enclave,
 * Android Keystore, and cloud KMS services (AWS, GCP, Azure).
 *
 * Requires @noble/curves (optional peer dependency). Loaded lazily on first use.
 *
 * @example
 * ```ts
 * import { P256Signer, P256Verifier } from "@alx-protocol/sdk/p256";
 *
 * const signer = new P256Signer(privateKeyBytes);
 * const verifier = new P256Verifier();
 * ```
 */

import type { Signer, Verifier } from "./signatures.js";
import { ErrorCode, protocolError } from "./errors.js";

interface P256Lib {
  getPublicKey(privateKey: Uint8Array, isCompressed?: boolean): Uint8Array;
  sign(message: Uint8Array, privateKey: Uint8Array): { toCompactRawBytes(): Uint8Array };
  verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
}

const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const P256_HALF_ORDER = P256_ORDER >> 1n;

function fixedHexToBytes(value: string, byteLength: number, allowMissingPrefix = false): Uint8Array | null {
  const pattern = allowMissingPrefix
    ? new RegExp(`^(?:0x)?[a-fA-F0-9]{${byteLength * 2}}$`)
    : new RegExp(`^0x[a-f0-9]{${byteLength * 2}}$`);
  if (!pattern.test(value)) return null;
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  return Uint8Array.from({ length: byteLength }, (_, i) => Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16));
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt("0x" + bytesToHex(bytes));
}

function canonicalizeCompactSignature(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) {
    throw protocolError(ErrorCode.INVALID_SIGNATURE_FORMAT, "P-256 signature must be exactly 64 bytes");
  }
  const result = new Uint8Array(signature);
  const s = bytesToBigInt(result.slice(32));
  const canonicalS = s > P256_HALF_ORDER ? P256_ORDER - s : s;
  const sHex = canonicalS.toString(16).padStart(64, "0");
  result.set(fixedHexToBytes(sHex, 32, true)!, 32);
  return result;
}

function isCanonicalCompactSignature(signature: Uint8Array): boolean {
  if (signature.length !== 64) return false;
  const r = bytesToBigInt(signature.slice(0, 32));
  const s = bytesToBigInt(signature.slice(32));
  return r > 0n && r < P256_ORDER && s > 0n && s <= P256_HALF_ORDER;
}

async function loadP256(): Promise<P256Lib> {
  const candidates = [
    "@noble/curves/p256.js",
    "@noble/curves/p256",
    "@noble/curves/nist.js",
  ];
  for (const specifier of candidates) {
    try {
      const mod = await (Function(`return import(${JSON.stringify(specifier)})`)()) as { p256: P256Lib };
      if (mod.p256) return mod.p256;
    } catch {
      // try next export path
    }
  }
  throw protocolError(ErrorCode.CRYPTO_REQUIRED, "@noble/curves is required for P-256 operations. Install: npm install @noble/curves");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * P-256 signer for ALX Block attestations.
 *
 * Used with WebAuthn, passkeys, mobile hardware keys, and cloud KMS.
 */
export class P256Signer implements Signer {
  readonly algorithm = "p256" as const;
  private privateKey: Uint8Array;
  private publicKeyHex: string | null = null;

  constructor(privateKey: Uint8Array | string) {
    const decoded = typeof privateKey === "string" ? fixedHexToBytes(privateKey, 32, true) : privateKey;
    if (!decoded || decoded.length !== 32 || bytesToBigInt(decoded) <= 0n || bytesToBigInt(decoded) >= P256_ORDER) {
      throw protocolError(ErrorCode.INVALID_KEY, "P-256 private key must be exactly 32 bytes");
    }
    this.privateKey = decoded;
  }

  async getId(): Promise<string> {
    if (!this.publicKeyHex) {
      const p256 = await loadP256();
      const pub = p256.getPublicKey(this.privateKey, false);
      this.publicKeyHex = "0x" + bytesToHex(pub);
    }
    return this.publicKeyHex;
  }

  async sign(data: Uint8Array): Promise<string> {
    if (data.length !== 32) {
      throw protocolError(ErrorCode.INVALID_SIGNATURE_FORMAT, "P-256 attestation input must be a 32-byte digest");
    }
    const p256 = await loadP256();
    const sig = canonicalizeCompactSignature(p256.sign(data, this.privateKey).toCompactRawBytes());
    return "0x" + bytesToHex(sig);
  }
}

/**
 * P-256 verifier for ALX Block attestations.
 */
export class P256Verifier implements Verifier {
  readonly algorithm = "p256" as const;

  async verify(data: Uint8Array, signature: string, expectedSigner?: string): Promise<{ ok: boolean; signer: string }> {
    if (!expectedSigner) {
      return { ok: false, signer: "" };
    }

    const sigBytes = fixedHexToBytes(signature, 64);
    const pubBytes = fixedHexToBytes(expectedSigner, 65);
    if (data.length !== 32 || !sigBytes || !pubBytes || pubBytes[0] !== 0x04 || !isCanonicalCompactSignature(sigBytes)) {
      return { ok: false, signer: expectedSigner };
    }
    const p256 = await loadP256();

    try {
      const valid = p256.verify(sigBytes, data, pubBytes);
      return { ok: valid, signer: expectedSigner };
    } catch {
      return { ok: false, signer: expectedSigner };
    }
  }
}
