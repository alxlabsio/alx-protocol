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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
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
    this.privateKey = typeof privateKey === "string" ? hexToBytes(privateKey) : privateKey;
    if (this.privateKey.length !== 32) {
      throw protocolError(ErrorCode.INVALID_KEY, "P-256 private key must be exactly 32 bytes");
    }
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
    const p256 = await loadP256();
    const sig = p256.sign(data, this.privateKey);
    return "0x" + bytesToHex(sig.toCompactRawBytes());
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

    const p256 = await loadP256();
    const sigBytes = hexToBytes(signature);
    const pubBytes = hexToBytes(expectedSigner);

    try {
      const valid = p256.verify(sigBytes, data, pubBytes);
      return { ok: valid, signer: expectedSigner };
    } catch {
      return { ok: false, signer: expectedSigner };
    }
  }
}
