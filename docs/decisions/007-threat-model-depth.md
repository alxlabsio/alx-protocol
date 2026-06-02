# ADR-007: Threat Model Scope And Residual Risk Surface

This architecture decision records how ALX Protocol scopes its security guarantees, which threats sit outside protocol scope, and the residual risk surface implementers and operators accept.

---

**Date:** 2026-05-31

## Context

ALX Protocol provides deterministic identity, lineage binding, and structural attribution for JSON artifacts. Protocol value depends on the credibility of ALX Protocol security claims. Overstating guarantees creates exploitable gaps; understating the guarantees reduces adoption.

A clear threat model separates protocol-layer guarantees (what the hash and graph structure enforce) from application-layer responsibilities (what operators and integrators must enforce on top). Without this separation, security audits cannot assess scope, integrators cannot correctly assign responsibility, and grant reviewers cannot evaluate risk.

## Decision

ALX Protocol defines a **narrow, formally stated threat surface** bounded by cryptographic hash properties and deterministic graph structure. All threats outside this boundary are explicitly documented as application-layer or out-of-scope, rather than silently assumed away.

## In-Scope Threats (Protocol Layer)

| Threat | Protocol response | Residual risk |
|---|---|---|
| **Content tampering** | `validateBlock` recomputes `keccak256(canonicalize({ content, parentHashes }))` and compares to stored `blockHash`. Any modification produces a detectable mismatch. | None at protocol layer. Content integrity after publication depends on operator storage controls. |
| **Lineage forgery** | `parentHashes` are bound into `blockHash`. Changing declared parents changes identity. `verifyGraph` recomputes all hashes in a graph. | An attacker who controls content at creation time can declare false parents. Detection requires external provenance of the parent Blocks themselves. |
| **Graph cycle injection** | `traceAttribution` detects cycles and surfaces `cycle: true`. Cycle detection is O(V + E). | Large adversarial graphs can make cycle detection slow. The `validateGraph` path enforces cycle rejection for well-formed graphs. |
| **Hash collision (birthday attack)** | Keccak-256 provides approximately 2¹²⁸ collision resistance. | No practical collision is known or expected. Post-quantum migration requires a new `protocolVersion`. |
| **Second-preimage attack** | Canonical serialization is deterministic and injective for valid inputs. Identical canonical strings produce identical hashes; distinct canonical strings produce distinct hashes with overwhelming probability. | No known vector. |
| **Replay of signed protocol payloads** | EIP-712 signatures include nonce, expiry, and chain ID. Replay protection is enforced in `verifySignedProtocolPayload`. | Signers must manage nonce state. Stateless verifiers cannot detect nonce reuse across sessions without external coordination. |
| **Parent flooding (DoS)** | Normalization deduplicates and enforces a maximum of 256 parent hashes after deduplication (LIMIT-001). | An attacker can still declare 256 expensive-to-fetch parents, requiring 256 Block resolutions to verify lineage. Implementers SHOULD apply rate limits at the Block creation boundary. |
| **Canonicalization depth overflow** | Canonicalization enforces a maximum nesting depth of 128 levels (LIMIT-002). Inputs exceeding this depth are rejected with `ALX_CANONICALIZATION_DEPTH`. | A 128-level input still requires O(n) recursive descent. Implementations SHOULD enforce memory limits in production environments. |
| **Unsupported protocol version** | `validateBlock` rejects any Block declaring a `protocolVersion` other than `"1"` with `ALX_UNSUPPORTED_VERSION`. | Operators running mixed-version environments must coordinate version upgrade paths explicitly. |

## Out-Of-Scope Threats (Application Layer)

| Threat | Why out of scope | Application-layer mitigation |
|---|---|---|
| **Truthfulness of content** | ALX Protocol treats content as opaque. A Block containing false claims has a valid `blockHash`. | Content validation, fact-checking, and semantic review are application responsibilities. |
| **Real-world identity of actors** | Block creation is permissionless. Any party can create a Block claiming any content. | Identity verification, attestation trust policies, and actor reputation systems are application-layer concerns. |
| **Sybil attacks** | Multiple Blocks can be created by the same actor under different identities. The protocol has no concept of actor uniqueness. | Attestation bonding, staking, or identity verification at the application layer mitigates sybil risk. |
| **Economic fairness of `pathCount`** | `pathCount` is a structural metric (number of distinct paths through the graph). Economic interpretation — royalties, attribution weights, contribution credit — is application policy, not protocol semantics. | Applications that use `pathCount` for economic settlement MUST define their own weighting policy on top. |
| **Storage availability** | `parentHashes` are content-addressed references, not storage guarantees. A Block may reference a parent that is unavailable. | Operators are responsible for persistence, replication, and availability of Block content. `validateIncrementalBlock` with open-world validation provides a protocol-level mechanism for partial graphs. |
| **Backdated attestation** | Attestation timestamps are signer-provided and not verified by the protocol. A signer can claim any timestamp. | On-chain anchoring (`ALXAnchor` on Base) provides trustless prior-existence proof independent of signer-provided timestamps. |
| **Sensitive content in Blocks** | The protocol cannot prevent a Block from containing regulated data (PII, health records, credentials). Once a Block is sealed, the content is bound to its identity. | Deployments MUST apply DLP scanning and data classification before calling `createBlock`. See `docs/integrators/deployment-checklist.md`. |

## Design Options Reviewed

- **Narrow scope with explicit residual risk (selected):** Define exactly what the protocol guarantees, document what it does not, and require application-layer mitigation for everything outside. Enables independent security audits with clear scope. Reduces integration errors caused by assumed guarantees.

- **Broad scope with optional extensions:** Attempt to address sybil, identity, and economic fairness at the protocol layer through optional modules. Rejected — complexity grows faster than adoption, and the extensions become load-bearing infrastructure rather than optional adapters.

- **No formal threat model:** Ship with informal trust assumptions. Rejected — grant reviewers and enterprise adopters require formal scope documentation before approving integration.

## Consequences

- Security audits can assess exactly the cryptographic hash properties and graph traversal semantics without needing to evaluate application-layer concerns.
- Integrators have a clear responsibility boundary: protocol handles structural integrity; applications handle semantic truth, identity, and economic policy.
- Post-quantum readiness requires a new `protocolVersion` (see `protocol/spec.md` Invariant 9) when a replacement hash function is standardized. The current Keccak-256 surface is documented in ADR-001.
- The `ALXAnchor` contract on Base addresses the backdated-attestation residual risk by providing trustless on-chain prior-existence timestamps independent of signer-provided values.

## Related Documents

- [`../trust-model.md`](../trust-model.md) — verification scope and boundaries
- [`../governance/security.md`](../governance/security.md) — cryptographic assumptions and signing model
- [`001-keccak-256.md`](001-keccak-256.md) — hash function selection rationale
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol rules and limits
- [`../../protocol/limits.json`](../../protocol/limits.json) — normative protocol limits
- [`../../contracts/ALXAnchor.sol`](../../contracts/ALXAnchor.sol) — on-chain existence-time anchor
- [`../integrators/deployment-checklist.md`](../integrators/deployment-checklist.md) — application-layer operator responsibilities
