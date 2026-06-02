/**
 * ed25519.ts — Ed25519 implementation of the Signer/Verifier interfaces.
 *
 * Provides Ed25519 signing for ALX Block attestations. Uses @noble/ed25519
 * (audited, zero-dependency, 4KB) for cryptographic operations.
 *
 * Requires @noble/ed25519 (optional peer dependency). Loaded lazily on first use.
 *
 * @example
 * ```ts
 * import { Ed25519Signer, Ed25519Verifier } from "@alx-protocol/sdk/ed25519";
 *
 * const signer = new Ed25519Signer(privateKeyHex);
 * const verifier = new Ed25519Verifier();
 * ```
 */

import type { Signer, Verifier } from "./signatures.js";
import { ErrorCode, protocolError } from "./errors.js";

interface Ed25519Lib {
  getPublicKey(privateKey: Uint8Array): Promise<Uint8Array> | Uint8Array;
  sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> | Uint8Array;
  verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> | boolean;
}

/** Lazily resolve @noble/ed25519. */
async function loadEd25519(): Promise<Ed25519Lib> {
  // Try @noble/ed25519 (standalone, v3 has SHA-512 built-in)
  try {
    const ed = await (Function('return import("@noble/ed25519")')()) as any;
    // v2 needs SHA-512 setup; v3 has it built-in
    if (ed.etc && !ed.etc.sha512Sync) {
      const { createHash } = await import("node:crypto");
      ed.etc.sha512Sync = (...msgs: Uint8Array[]) => {
        const h = createHash("sha512");
        for (const m of msgs) h.update(m);
        return new Uint8Array(h.digest());
      };
    }
    return ed as Ed25519Lib;
  } catch { /* not available */ }

  // Fallback: @noble/curves
  for (const specifier of ["@noble/curves/ed25519.js", "@noble/curves/ed25519"]) {
    try {
      const curves = await (Function(`return import(${JSON.stringify(specifier)})`)()) as { ed25519: Ed25519Lib };
      if (curves.ed25519) return curves.ed25519;
    } catch { /* not available */ }
  }

  throw protocolError(ErrorCode.CRYPTO_REQUIRED, "@noble/ed25519 or @noble/curves is required. Install: npm install @noble/ed25519");
}

/** Convert a hex string to Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Convert Uint8Array to hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ed25519 signer for ALX Block attestations.
 *
 * @example
 * ```ts
 * const signer = new Ed25519Signer(privateKeyHex);
 * const block = await createSignedBlock(content, parents, signer);
 * ```
 */
export class Ed25519Signer implements Signer {
  readonly algorithm = "ed25519" as const;
  private privateKey: Uint8Array;
  private publicKeyHex: string | null = null;

  /**
   * @param privateKey — 32-byte Ed25519 private key as Uint8Array or hex string (with or without 0x prefix)
   */
  constructor(privateKey: Uint8Array | string) {
    this.privateKey = typeof privateKey === "string" ? hexToBytes(privateKey) : privateKey;
    if (this.privateKey.length !== 32) {
      throw protocolError(ErrorCode.INVALID_KEY, "Ed25519 private key must be exactly 32 bytes");
    }
  }

  async getId(): Promise<string> {
    if (!this.publicKeyHex) {
      const ed = await loadEd25519();
      const pub = await ed.getPublicKey(this.privateKey);
      this.publicKeyHex = "0x" + bytesToHex(pub instanceof Uint8Array ? pub : new Uint8Array(pub));
    }
    return this.publicKeyHex;
  }

  async sign(data: Uint8Array): Promise<string> {
    const ed = await loadEd25519();
    const signature = await ed.sign(data, this.privateKey);
    return "0x" + bytesToHex(signature instanceof Uint8Array ? signature : new Uint8Array(signature));
  }
}

/**
 * Ed25519 verifier for ALX Block attestations.
 *
 * @example
 * ```ts
 * const verifier = new Ed25519Verifier();
 * const result = await validateSignedBlock(block, verifier);
 * ```
 */
export class Ed25519Verifier implements Verifier {
  readonly algorithm = "ed25519" as const;

  async verify(data: Uint8Array, signature: string, expectedSigner?: string): Promise<{ ok: boolean; signer: string }> {
    if (!expectedSigner) {
      return { ok: false, signer: "" };
    }

    const ed = await loadEd25519();
    const sigBytes = hexToBytes(signature);
    const pubBytes = hexToBytes(expectedSigner);

    try {
      const valid = await ed.verify(sigBytes, data, pubBytes);
      return { ok: !!valid, signer: expectedSigner };
    } catch {
      return { ok: false, signer: expectedSigner };
    }
  }
}
