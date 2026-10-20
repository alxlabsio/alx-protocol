# ADR-007: Threat Model Scope And Residual Risk Surface

This architecture decision records how ALX Protocol scopes its security guarantees, which threats sit outside protocol scope, and the residual risk surface implementers and operators accept.

---

**Date:** 2026-05-31

## Context

ALX Protocol provides deterministic identity, lineage binding, and structural attribution for Blocks containing ALX values. Protocol value depends on precise security claims. Overstating guarantees creates exploitable gaps; understating the guarantees obscures the useful boundary.

A clear threat model separates protocol-layer guarantees (what the hash and graph structure enforce) from application-layer responsibilities (what operators and integrators must enforce on top). Without this separation, security audits cannot assess scope, integrators cannot correctly assign responsibility, and grant reviewers cannot evaluate risk.

## Decision

ALX Protocol defines a **narrow, formally stated threat surface** bounded by cryptographic hash properties and deterministic graph structure. All threats outside this boundary are explicitly documented as application-layer or out-of-scope, rather than silently assumed away.

## In-Scope Threats (Protocol Layer)

| Threat | Protocol response | Residual risk |
|---|---|---|
| **Content tampering** | `validateBlock` recomputes the domain-separated v1 Block hash and compares it to stored `blockHash`. Any modification produces a detectable mismatch. | None at protocol layer. Content integrity after publication depends on operator storage controls. |
| **Misleading declared lineage** | `parentHashes` are bound into `blockHash`. Canonical Graph verification checks reachable available Blocks and relationships in the requested context. | A creator can declare a structurally valid but semantically misleading parent. Causality and source eligibility require application evidence. |
| **Graph cycle injection** | `traceAttribution` detects cycles and fails with `ALX_GRAPH_CYCLE`. Cycle detection is O(V + E). | Large adversarial graphs can make cycle detection slow. The `validateGraph` path reports cycle issues for diagnostic use. |
| **Hash collision (birthday attack)** | Keccak-256 provides approximately 2¹²⁸ collision resistance. | No practical collision is known or expected. Post-quantum migration requires a new `protocolVersion`. |
| **Second-preimage attack** | Canonical serialization is deterministic and injective for valid inputs. Identical canonical strings produce identical hashes; distinct canonical strings produce distinct hashes with overwhelming probability. | No known vector. |
| **Replay of application-signed requests** | The TypeScript SDK exposes optional signed-request and replay-window helpers. | Applications must persist nonce state and define authorization, expiry, clock, domain, and identity policy. This is outside core conformance. |
| **Parent flooding (DoS)** | Normalization deduplicates and enforces the specification maximum of 256 parent hashes after deduplication. | An attacker can still declare 256 expensive-to-fetch parents, requiring 256 Block resolutions to verify lineage. Implementers SHOULD apply rate limits at the Block creation boundary. |
| **Canonicalization depth overflow** | Canonicalization enforces the specification maximum nesting depth of 128 levels. Inputs exceeding this depth are rejected with `ALX_CANONICALIZATION_DEPTH`. | A 128-level input still requires O(n) recursive descent. Implementations SHOULD enforce memory limits in production environments. |
| **Unsupported protocol version** | `validateBlock` rejects any Block declaring a `protocolVersion` other than `"1"` with `ALX_UNSUPPORTED_VERSION`. | Operators running mixed-version environments must coordinate version upgrade paths explicitly. |

## Out-Of-Scope Threats (Application Layer)

| Threat | Why out of scope | Application-layer mitigation |
|---|---|---|
| **Truthfulness of content** | ALX Protocol treats content as opaque. A Block containing false claims has a valid `blockHash`. | Content validation, fact-checking, and semantic review are application responsibilities. |
| **Real-world identity of actors** | Block creation is permissionless. Any party can create a Block claiming any content. | Identity verification, attestation trust policies, and actor reputation systems are application-layer concerns. |
| **Sybil attacks** | Multiple Blocks can be created by the same actor under different identities. The protocol has no concept of actor uniqueness. | Attestation bonding, staking, or identity verification at the application layer mitigates sybil risk. |
| **Economic fairness of `pathCount`** | `pathCount` is a structural metric: the number of distinct paths through the Graph. Economic interpretation is not protocol semantics. | An application that uses `pathCount` economically must define and justify its own policy. |
| **Storage availability** | `parentHashes` are references, not storage guarantees. A Block may reference an unavailable parent. | Operators provide persistence and discovery. Canonical Graph verification reports `incomplete` or an explicitly scoped open-world result. |
| **Backdated attestation** | Attestation timestamps are signer-provided and not verified by the protocol. A signer can claim any allowed timestamp. | External timestamping or anchoring may provide separate prior-existence evidence under that system's assumptions. |
| **Sensitive content in Blocks** | The protocol cannot prevent a Block from containing regulated data, health records, credentials, or other sensitive values. | Deployments should apply privacy, DLP, consent, and data-classification policy before Block creation or persistence. |

## Design Options Reviewed

- **Narrow scope with explicit residual risk (selected):** Define exactly what the protocol guarantees, document what it does not, and require application-layer mitigation for everything outside. Enables independent security audits with clear scope. Reduces integration errors caused by assumed guarantees.

- **Broad scope with optional extensions:** Attempt to address sybil, identity, and economic fairness at the protocol layer through optional modules. Rejected — complexity grows faster than adoption, and the extensions become load-bearing infrastructure rather than optional adapters.

- **No formal threat model:** Ship with informal trust assumptions. Rejected — grant reviewers and enterprise adopters require formal scope documentation before approving integration.

## Consequences

- Security audits can assess exactly the cryptographic hash properties and graph traversal semantics without needing to evaluate application-layer concerns.
- Integrators have a clear responsibility boundary: protocol handles structural integrity; applications handle semantic truth, identity, and economic policy.
- Post-quantum readiness requires a new `protocolVersion` (see `protocol/spec.md` Invariant 9) when a replacement hash function is standardized. The current Keccak-256 surface is documented in ADR-001.
- An optional `ALXAnchor` deployment can provide separate chain-record evidence under the selected network and finality assumptions; it does not validate the Block or its signer-provided timestamp.

## Related Documents

- [`../trust-model.md`](../trust-model.md) — verification scope and boundaries
- [`../governance/protocol-security-model.md`](../governance/protocol-security-model.md) — cryptographic assumptions and signing model
- [`001-keccak-256.md`](001-keccak-256.md) — hash function selection rationale
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol rules and limits
- [`../../contracts/src/ALXAnchor.sol`](../../contracts/src/ALXAnchor.sol) — on-chain existence-time anchor
- [`../integrators/deployment-checklist.md`](../integrators/deployment-checklist.md) — application-layer operator responsibilities
