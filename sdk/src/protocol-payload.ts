/**
 * protocol-payload.ts — EIP-712 protocol payload normalization and verification.
 *
 * Handles the signed request surface: building the signing domain,
 * normalizing payload fields, and verifying signatures against replay
 * windows and expected signers.
 *
 * Signing interfaces (Signer, Verifier) and block-level types live in signatures.ts.
 */

import { ErrorCode, protocolError } from "./errors.js";
import { validateReplayWindow } from "./replay.js";
import {
  PROTOCOL_SIGNING_DOMAIN_NAME,
  PROTOCOL_SIGNING_DOMAIN_VERSION,
  PROTOCOL_SIGNED_REQUEST_TYPES,
} from "./signatures.js";
import type { NormalizedPayload, VerificationResult } from "./signatures.js";

export type { NormalizedPayload, VerificationResult } from "./signatures.js";

type VerifyTypedDataFn = (
  domain: object,
  types: object,
  value: object,
  signature: string,
) => string;

/** Lazily resolve ethers.verifyTypedData. Throws a clear error if ethers is not installed. */
async function loadVerifyTypedData(): Promise<VerifyTypedDataFn> {
  try {
    const ethers = await import("ethers");
    return ethers.verifyTypedData as VerifyTypedDataFn;
  } catch {
    throw protocolError(ErrorCode.ETHERS_REQUIRED, "ethers is required for signature operations. Install it: npm install ethers");
  }
}

function normalizeAddress(value: unknown): string {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw protocolError(ErrorCode.INVALID_ADDRESS, "actor must be a 20-byte hex address");
  }
  return value.toLowerCase();
}

function normalizeBytes32(value: unknown): string {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw protocolError(ErrorCode.INVALID_PAYLOAD_HASH, "payloadHash must be a 32-byte hex value");
  }
  return value.toLowerCase();
}

export function normalizeSignedProtocolPayload(payload: Record<string, unknown> = {}): NormalizedPayload {
  const actor = normalizeAddress(payload.actor);
  const nonce = payload?.nonce ? String(payload.nonce) : "";
  const expiry = Number(payload?.expiry);
  const chainId = Number(payload?.chainId);
  const domain = payload?.domain ? String(payload.domain) : "";
  const action = payload?.action ? String(payload.action) : "";
  const payloadHash = normalizeBytes32(payload.payloadHash);

  if (!nonce) throw protocolError(ErrorCode.NONCE_REQUIRED, "nonce is required");
  if (!Number.isSafeInteger(expiry) || expiry < 0) throw protocolError(ErrorCode.INVALID_EXPIRY, "expiry must be a non-negative safe integer");
  if (!Number.isSafeInteger(chainId) || chainId < 0) throw protocolError(ErrorCode.INVALID_CHAIN_ID, "chainId must be a non-negative safe integer");
  if (!domain) throw protocolError(ErrorCode.DOMAIN_REQUIRED, "domain is required");
  if (!action) throw protocolError(ErrorCode.ACTION_REQUIRED, "action is required");

  return { actor, nonce, expiry, chainId, domain, action, payloadHash };
}

/**
 * Build the EIP-712 signing domain for ALX Protocol.
 */
export function buildProtocolSigningDomain({ chainId, verifyingContract = "0x0000000000000000000000000000000000000000" }: {
  chainId: number;
  verifyingContract?: string;
} = { chainId: 0 }) {
  const normalizedChainId = Number(chainId);
  if (!Number.isSafeInteger(normalizedChainId) || normalizedChainId < 0) {
    throw protocolError(ErrorCode.INVALID_CHAIN_ID, "chainId must be a non-negative safe integer");
  }
  if (typeof verifyingContract !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(verifyingContract)) {
    throw protocolError(ErrorCode.INVALID_CONTRACT, "verifyingContract must be a 20-byte hex address");
  }

  return {
    name: PROTOCOL_SIGNING_DOMAIN_NAME,
    version: PROTOCOL_SIGNING_DOMAIN_VERSION,
    chainId: normalizedChainId,
    verifyingContract,
  };
}

export async function verifySignedProtocolPayload(
  {
    payload,
    signature,
    expectedSigner = null,
    expectedChainId = null,
    expectedDomain = null,
    seenNonceKeys = new Set<string>(),
    nowSeconds = Math.floor(Date.now() / 1000),
    allowedClockSkewSeconds = 0,
    verifyingContract = "0x0000000000000000000000000000000000000000",
  }: {
    payload: Record<string, unknown>;
    signature: string;
    expectedSigner?: string | null;
    expectedChainId?: number | null;
    expectedDomain?: string | null;
    seenNonceKeys?: Set<string>;
    nowSeconds?: number;
    allowedClockSkewSeconds?: number;
    verifyingContract?: string;
  },
  verifyTypedDataFn?: VerifyTypedDataFn,
): Promise<VerificationResult> {
  let normalizedPayload: NormalizedPayload;
  try {
    normalizedPayload = normalizeSignedProtocolPayload(payload);
  } catch (error) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const replay = validateReplayWindow(normalizedPayload, {
    nowSeconds,
    seenNonceKeys,
    expectedChainId,
    expectedDomain,
    allowedClockSkewSeconds,
  });
  if (!replay.ok) return replay;

  if (typeof signature !== "string" || !signature.startsWith("0x")) {
    return { ok: false, code: "invalid_signature", reason: "signature must be a hex string" };
  }

  const verifyFn = verifyTypedDataFn ?? await loadVerifyTypedData();

  let recoveredSigner: string;
  try {
    recoveredSigner = String(
      verifyFn(
        buildProtocolSigningDomain({ chainId: normalizedPayload.chainId, verifyingContract }),
        PROTOCOL_SIGNED_REQUEST_TYPES,
        normalizedPayload,
        signature,
      ),
    ).toLowerCase();
  } catch (error) {
    return {
      ok: false,
      code: "invalid_signature",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (expectedSigner != null && recoveredSigner !== String(expectedSigner).toLowerCase()) {
    return { ok: false, code: "signer_mismatch", signer: recoveredSigner, nonceKey: replay.nonceKey };
  }

  if (recoveredSigner !== normalizedPayload.actor) {
    return { ok: false, code: "actor_mismatch", signer: recoveredSigner, nonceKey: replay.nonceKey };
  }

  return { ok: true, code: "ok", signer: recoveredSigner, nonceKey: replay.nonceKey };
}
