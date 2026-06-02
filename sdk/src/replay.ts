import { ErrorCode, protocolError } from "./errors.js";

/** Result of replay window validation. */
export interface ReplayResult {
  ok: boolean;
  code: string;
  nonceKey?: string;
}

/**
 * Build a scoped nonce key for replay detection.
 *
 * Uses null-byte (\0) as separator to prevent collisions when
 * actor or nonce strings contain delimiter characters.
 */
export function buildReplayScopeKey({ actor, nonce, chainId = null, domain = null }: {
  actor: string;
  nonce: string;
  chainId?: number | null;
  domain?: string | null;
}): string {
  if (!actor) throw protocolError(ErrorCode.ACTOR_REQUIRED, "actor is required");
  if (!nonce) throw protocolError(ErrorCode.NONCE_REQUIRED, "nonce is required");
  return [String(actor), String(nonce), chainId == null ? "*" : String(chainId), domain == null ? "*" : String(domain)].join("\0");
}

/**
 * Validate a replay window.
 *
 * All time values are in seconds (Unix epoch). This matches the EIP-712
 * convention where expiry is uint256 seconds.
 */
export function validateReplayWindow(
  payload: {
    actor?: string;
    nonce?: string;
    expiry?: number;
    chainId?: number | null;
    domain?: string | null;
  },
  {
    nowSeconds = Math.floor(Date.now() / 1000),
    seenNonceKeys = new Set<string>(),
    expectedChainId = null as number | null,
    expectedDomain = null as string | null,
    allowedClockSkewSeconds = 0,
  } = {},
): ReplayResult {
  const actor = payload?.actor ? String(payload.actor) : "";
  const nonce = payload?.nonce ? String(payload.nonce) : "";
  const expiry = Number(payload?.expiry);
  const chainId = payload?.chainId ?? null;
  const domain = payload?.domain ?? null;

  if (!actor) return { ok: false, code: "missing_actor" };
  if (!nonce) return { ok: false, code: "missing_nonce" };
  if (!Number.isFinite(expiry)) return { ok: false, code: "missing_expiry" };
  if (expectedChainId != null && chainId !== expectedChainId) return { ok: false, code: "chain_mismatch" };
  if (expectedDomain != null && domain !== expectedDomain) return { ok: false, code: "domain_mismatch" };
  if (expiry + allowedClockSkewSeconds < nowSeconds) return { ok: false, code: "expired" };

  const nonceKey = buildReplayScopeKey({ actor, nonce, chainId, domain });
  if (seenNonceKeys.has(nonceKey)) return { ok: false, code: "replayed_nonce", nonceKey };

  return {
    ok: true,
    code: "ok",
    nonceKey,
  };
}
