import { ErrorCode, protocolError } from "./errors.js";

// ── Algorithm-agnostic signing interfaces ─────────────────────────────────

/**
 * Algorithm-agnostic signer. Implement this interface for any signing scheme
 * (EIP-712, Ed25519, RSA, ECDSA, cloud KMS, hardware wallets, etc.).
 */
export interface Signer {
  /** Returns the signer's public identifier (address, public key, DID, etc.) */
  getId(): Promise<string>;
  /** Signs the given data and returns the signature as a hex string */
  sign(data: Uint8Array): Promise<string>;
  /** Algorithm identifier (e.g., "eip712", "ed25519", "ecdsa-secp256k1") */
  readonly algorithm: string;
}

/**
 * Algorithm-agnostic verifier. Recovers or validates a signer identity
 * from a signature over the given data.
 */
export interface Verifier {
  /** Verify a signature. Returns the recovered signer identity and whether it's valid. */
  verify(data: Uint8Array, signature: string, expectedSigner?: string): Promise<{ ok: boolean; signer: string }>;
  /** Algorithm identifier — must match the Signer that produced the signature */
  readonly algorithm: string;
}

// ── EIP-712 signing domain ────────────────────────────────────────────────

/**
 * EIP-712 signing domain for ALX Protocol.
 */
export const PROTOCOL_SIGNING_DOMAIN_NAME = "ALXProtocol" as const;
export const PROTOCOL_SIGNING_DOMAIN_VERSION = "1" as const;

export const PROTOCOL_SIGNED_REQUEST_TYPES = {
  ProtocolRequest: [
    { name: "actor", type: "address" },
    { name: "nonce", type: "string" },
    { name: "expiry", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "domain", type: "string" },
    { name: "action", type: "string" },
    { name: "payloadHash", type: "bytes32" },
  ],
};

/** A normalized protocol request payload. */
export interface NormalizedPayload {
  actor: string;
  nonce: string;
  expiry: number;
  chainId: number;
  domain: string;
  action: string;
  payloadHash: string;
}

/** Result of payload or signature verification. */
export interface VerificationResult {
  ok: boolean;
  code: string;
  reason?: string;
  signer?: string;
  nonceKey?: string;
}

/** A block attestation (signed block hash). */
export interface BlockAttestation {
  blockHash: string;
  attester: string;
  algorithm: string;
  timestamp: number;
  signature: string;
}

// ── Block signing ─────────────────────────────────────────────────────────

export const BLOCK_ATTESTATION_TYPES = {
  BlockAttestation: [
    { name: "blockHash", type: "bytes32" },
    { name: "attester", type: "address" },
    { name: "timestamp", type: "uint256" },
  ],
};

/**
 * @deprecated Use `createSignedBlock()` with an `Eip712Signer` instead. Will be removed in v2.0.
 *
 * Sign a block hash using EIP-712 — attest that this signer produced or verified this block.
 */
export async function signBlock(blockHash: string, { signer, chainId, verifyingContract, timestamp }: {
  signer: { getAddress(): Promise<string>; signTypedData(domain: object, types: object, value: object): Promise<string> };
  chainId: number;
  verifyingContract?: string;
  timestamp?: number;
}): Promise<BlockAttestation> {
  const normalizedHash = String(blockHash ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalizedHash)) {
    throw protocolError(ErrorCode.INVALID_BLOCK_HASH, "blockHash must be a 0x-prefixed 32-byte hex value");
  }

  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const attester = await signer.getAddress();

  const domain = buildProtocolSigningDomain({
    chainId,
    verifyingContract,
  });

  const value = {
    blockHash: normalizedHash,
    attester: attester.toLowerCase(),
    timestamp: ts,
  };

  const sig = await signer.signTypedData(domain, BLOCK_ATTESTATION_TYPES, value);

  return {
    blockHash: normalizedHash,
    attester: attester.toLowerCase(),
    algorithm: "eip712",
    timestamp: ts,
    signature: sig,
  };
}

/**
 * @deprecated Use `validateSignedBlock()` with an `Eip712Verifier` instead. Will be removed in v2.0.
 *
 * Verify a block attestation signature.
 */
export async function verifyBlockSignature(attestation: BlockAttestation, opts: {
  chainId: number;
  verifyingContract?: string;
  expectedAttester?: string;
}): Promise<{ ok: boolean; code: string; recoveredAttester?: string; reason?: string }> {
  try {
    const normalizedHash = attestation.blockHash.toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(normalizedHash)) {
      return { ok: false, code: "invalid_block_hash" };
    }

    const domain = buildProtocolSigningDomain({
      chainId: opts.chainId,
      verifyingContract: opts.verifyingContract,
    });

    const value = {
      blockHash: normalizedHash,
      attester: attestation.attester.toLowerCase(),
      timestamp: attestation.timestamp,
    };

    const verifyFn = await loadVerifyTypedData();
    const recovered = String(
      verifyFn(domain, BLOCK_ATTESTATION_TYPES, value, attestation.signature)
    ).toLowerCase();

    if (recovered !== attestation.attester.toLowerCase()) {
      return { ok: false, code: "attester_mismatch", recoveredAttester: recovered };
    }

    if (opts.expectedAttester && recovered !== opts.expectedAttester.toLowerCase()) {
      return { ok: false, code: "unexpected_attester", recoveredAttester: recovered };
    }

    return { ok: true, code: "ok", recoveredAttester: recovered };
  } catch (error) {
    return {
      ok: false,
      code: "invalid_signature",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
