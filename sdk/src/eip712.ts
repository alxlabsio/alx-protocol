/**
 * eip712.ts — EIP-712 implementation of the Signer/Verifier interfaces.
 *
 * Implements EIP-712 typed data hashing in pure JS (using js-sha3).
 * For signature recovery, uses @noble/secp256k1 if available, falling
 * back to ethers.verifyTypedData if not. This allows the SDK to work
 * without the 40MB ethers dependency when @noble/secp256k1 is installed.
 *
 * Priority: @noble/secp256k1 (4KB) > ethers (40MB)
 */

import type { Signer, Verifier } from "./signatures.js";
import { BLOCK_ATTESTATION_TYPES } from "./signatures.js";
import { buildProtocolSigningDomain } from "./protocol-payload.js";
import { hexToBytes, bytesToHex, concatBytes } from "./hash-utils.js";
import sha3pkg from "js-sha3";

const { keccak_256 } = sha3pkg;

type EthersWallet = {
  getAddress(): Promise<string>;
  signTypedData(domain: object, types: object, value: object): Promise<string>;
};

// ── Pure EIP-712 hashing (no external dependency) ──────────────────────

function keccak256Bytes(data: Uint8Array): Uint8Array {
  return hexToBytes(keccak_256(data));
}

function padTo32(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return hexToBytes(clean.padStart(64, "0"));
}

function encodeUint256(value: number | bigint): Uint8Array {
  const hex = typeof value === "bigint" ? value.toString(16) : Math.floor(Number(value)).toString(16);
  return padTo32(hex);
}

function encodeAddress(addr: string): Uint8Array {
  return padTo32(addr.startsWith("0x") ? addr.slice(2) : addr);
}

function encodeBytes32(hex: string): Uint8Array {
  return padTo32(hex.startsWith("0x") ? hex.slice(2) : hex);
}

/** Compute EIP-712 domain separator hash. */
function hashDomain(domain: { name: string; version: string; chainId: number; verifyingContract: string }): Uint8Array {
  const typeHash = keccak256Bytes(new TextEncoder().encode(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  ));
  const nameHash = keccak256Bytes(new TextEncoder().encode(domain.name));
  const versionHash = keccak256Bytes(new TextEncoder().encode(domain.version));
  const chainIdBytes = encodeUint256(domain.chainId);
  const contractBytes = encodeAddress(domain.verifyingContract);

  return keccak256Bytes(concatBytes(typeHash, nameHash, versionHash, chainIdBytes, contractBytes));
}

/** Compute EIP-712 BlockAttestation struct hash. */
function hashBlockAttestation(value: { blockHash: string; attester: string; timestamp: number }): Uint8Array {
  const typeHash = keccak256Bytes(new TextEncoder().encode(
    "BlockAttestation(bytes32 blockHash,address attester,uint256 timestamp)"
  ));
  return keccak256Bytes(concatBytes(
    typeHash,
    encodeBytes32(value.blockHash),
    encodeAddress(value.attester),
    encodeUint256(value.timestamp),
  ));
}

/** Compute the final EIP-712 signing hash: keccak256(0x1901 || domainSep || structHash). */
function computeEip712Hash(
  domain: { name: string; version: string; chainId: number; verifyingContract: string },
  value: { blockHash: string; attester: string; timestamp: number },
): Uint8Array {
  const domainSep = hashDomain(domain);
  const structHash = hashBlockAttestation(value);
  return keccak256Bytes(concatBytes(new Uint8Array([0x19, 0x01]), domainSep, structHash));
}

// ── Signature recovery (prefers @noble/secp256k1, falls back to ethers) ──

interface RecoverFn {
  (hash: Uint8Array, signature: string): string; // returns lowercase 0x address
}

let cachedRecoverFn: RecoverFn | null = null;

async function loadRecoverFn(): Promise<RecoverFn> {
  if (cachedRecoverFn) return cachedRecoverFn;

  // Try @noble/secp256k1 first (4KB, zero-dep)
  try {
    // @ts-ignore — optional peer dependency; not listed in package.json types
    const secp = await import("@noble/secp256k1") as any;
    cachedRecoverFn = (hash: Uint8Array, signature: string): string => {
      const sigBytes = hexToBytes(signature);
      const r = sigBytes.slice(0, 32);
      const s = sigBytes.slice(32, 64);
      const v = sigBytes[64];
      const recovery = v >= 27 ? v - 27 : v;
      const sig = new secp.Signature(
        BigInt("0x" + bytesToHex(r)),
        BigInt("0x" + bytesToHex(s)),
      ).addRecoveryBit(recovery);
      const pubkey = sig.recoverPublicKey(hash);
      const uncompressed = pubkey.toRawBytes(false).slice(1); // remove 0x04 prefix
      const addrBytes = keccak256Bytes(uncompressed).slice(12);
      return "0x" + bytesToHex(addrBytes);
    };
    return cachedRecoverFn;
  } catch { /* @noble/secp256k1 not available */ }

  // Try @noble/curves (alternative)
  try {
    // @ts-ignore — optional peer dependency; not listed in package.json types
    const curves = await import("@noble/curves/secp256k1.js") as any;
    const secp = curves.secp256k1;
    cachedRecoverFn = (hash: Uint8Array, signature: string): string => {
      const sigBytes = hexToBytes(signature);
      const r = sigBytes.slice(0, 32);
      const s = sigBytes.slice(32, 64);
      const v = sigBytes[64];
      const recovery = v >= 27 ? v - 27 : v;
      const sig = secp.Signature.fromCompact(bytesToHex(sigBytes.slice(0, 64))).addRecoveryBit(recovery);
      const pubkey = sig.recoverPublicKey(hash);
      const uncompressed = pubkey.toRawBytes(false).slice(1);
      const addrBytes = keccak256Bytes(uncompressed).slice(12);
      return "0x" + bytesToHex(addrBytes);
    };
    return cachedRecoverFn;
  } catch { /* @noble/curves not available */ }

  // Fallback to ethers (40MB but works)
  try {
    // @ts-ignore — optional peer dependency; not listed in package.json types
    const ethers = await import("ethers") as any;
    cachedRecoverFn = (hash: Uint8Array, signature: string): string => {
      // Use ethers' built-in recovery via recoverAddress
      const digest = "0x" + bytesToHex(hash);
      return String(ethers.recoverAddress(digest, signature)).toLowerCase();
    };
    return cachedRecoverFn;
  } catch { /* ethers not available */ }

  const { ErrorCode, protocolError } = await import("./errors.js");
  throw protocolError(ErrorCode.ETHERS_REQUIRED,
    "EIP-712 verification requires @noble/secp256k1 (preferred) or ethers. Install: npm install @noble/secp256k1");
}

// ── Signer & Verifier ──────────────────────────────────────────────────

/**
 * EIP-712 signer for ALX Block attestations.
 *
 * Requires an ethers-compatible wallet for signing (wallet.signTypedData).
 * Verification uses @noble/secp256k1 if available, ethers as fallback.
 */
export class Eip712Signer implements Signer {
  readonly algorithm = "eip712" as const;
  private wallet: EthersWallet;
  private chainId: number;
  private verifyingContract: string;
  private fixedTimestamp: number | undefined;

  constructor(wallet: EthersWallet, opts: { chainId: number; verifyingContract?: string; timestamp?: number }) {
    this.wallet = wallet;
    this.chainId = opts.chainId;
    this.verifyingContract = opts.verifyingContract ?? "0x0000000000000000000000000000000000000000";
    this.fixedTimestamp = opts.timestamp;
  }

  async getId(): Promise<string> {
    return (await this.wallet.getAddress()).toLowerCase();
  }

  async sign(data: Uint8Array): Promise<string> {
    const blockHash = "0x" + bytesToHex(data);
    const attester = await this.getId();
    const timestamp = this.fixedTimestamp ?? Math.floor(Date.now() / 1000);

    const domain = buildProtocolSigningDomain({
      chainId: this.chainId,
      verifyingContract: this.verifyingContract,
    });

    const value = { blockHash, attester, timestamp };
    const signature = await this.wallet.signTypedData(domain, BLOCK_ATTESTATION_TYPES, value);

    return `${timestamp}:${signature}`;
  }
}

/**
 * EIP-712 verifier for ALX Block attestations.
 *
 * Uses pure EIP-712 hashing (js-sha3) + secp256k1 recovery (@noble or ethers fallback).
 */
export class Eip712Verifier implements Verifier {
  readonly algorithm = "eip712" as const;
  private chainId: number;
  private verifyingContract: string;

  constructor(opts: { chainId: number; verifyingContract?: string }) {
    this.chainId = opts.chainId;
    this.verifyingContract = opts.verifyingContract ?? "0x0000000000000000000000000000000000000000";
  }

  async verify(data: Uint8Array, signature: string, expectedSigner?: string): Promise<{ ok: boolean; signer: string }> {
    const blockHash = "0x" + bytesToHex(data);

    // Parse "timestamp:signature" format
    const colonIdx = signature.indexOf(":");
    if (colonIdx === -1) {
      const { ErrorCode, protocolError } = await import("./errors.js");
      throw protocolError(ErrorCode.INVALID_SIGNATURE_FORMAT, "EIP-712 signature must include timestamp prefix (timestamp:0x...)");
    }
    const timestamp = parseInt(signature.slice(0, colonIdx), 10);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      return { ok: false, signer: "" };
    }
    const rawSig = signature.slice(colonIdx + 1);

    if (!expectedSigner) {
      return { ok: false, signer: "" };
    }

    // Compute EIP-712 hash (pure — no ethers needed)
    const domain = buildProtocolSigningDomain({
      chainId: this.chainId,
      verifyingContract: this.verifyingContract,
    });
    const value = { blockHash, attester: expectedSigner.toLowerCase(), timestamp };
    const eip712Hash = computeEip712Hash(domain, value);

    // Recover signer address (tries @noble/secp256k1 first, then ethers)
    try {
      const recover = await loadRecoverFn();
      const recovered = recover(eip712Hash, rawSig);
      const ok = recovered === expectedSigner.toLowerCase();
      return { ok, signer: recovered };
    } catch {
      return { ok: false, signer: "" };
    }
  }
}
