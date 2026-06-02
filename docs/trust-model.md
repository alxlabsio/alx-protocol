# Trust Model

ALX Protocol trust boundaries. Protocol behavior remains defined by [`../protocol/spec.md`](../protocol/spec.md).

---

## Purpose

Trust boundaries of ALX Protocol: what ALX Protocol verifies, what ALX Protocol excludes from verification, and what assumptions underlie protocol guarantees.

---

## ALX Verification Scope

| Property | How |

|---|---|

| Block Identity Verification | Recompute blockHash from content + parentHashes |

| Content Integrity Check | Hash matches canonical serialization of content |

| Derivation Graph Consistency | Graph is acyclic, no self-references, no duplicate parents |

| Attribution Structure Computation | pathCounts computed deterministically from graph traversal |

| Cross-Implementation Output Parity | Same input -> same output across TypeScript, Python, Rust |

| Merkle Inclusion Verification | Optional extension proof verification against anchored root hash |

| Signature Validity Verification | Optional extension signature verification |

## Verification Exclusions

| Claim | Exclusion reason |

|---|---|

| Truth of content | Content is opaque — semantic correctness remains outside protocol verification scope |

| Quality of AI reasoning | A structurally valid block can contain incorrect conclusions |

| Real-world identity | Block creators carry an address; verified identity requires external attestation |

| Availability of referenced blocks | `parentHashes` are references, independent of availability guarantees |

| Completeness of external lineage | Under **open-world** validation, external `parentHashes` may be declared but remain locally unresolved; Trace marks boundaries explicitly |

| Storage durability | Protocol is storage-independent — persistence is the storage layer's responsibility |

| Economic fairness | pathCounts describe structure; applications decide economic meaning |

## Trust Assumptions

1. **Keccak-256 is collision-resistant** — block identity depends on collision resistance. If collision attacks become practical, the protocol's identity guarantee weakens.

2. **Canonical serialization is unambiguous** — two implementations given the same JSON-compatible value MUST produce the same canonical string. The spec defines rules for every type.

3. **Parent hashes are honest references** — the protocol verifies format and structure; parent eligibility remains an application concern.

4. **Signing proves key control** — an EIP-712 signature proves the signer controlled a private key. Signer identity requires linkage to an external identity system.

5. **On-chain anchoring proves existence** — **ALXAnchor** on Base records a `blockHash` at chain time (optional). Merkle proofs remain an off-chain SDK extension unless an operator chooses a separate legacy checkpoint integration. On-chain anchoring excludes proof that underlying Blocks are correct.

## Threat Model Summary

| Threat | Mitigation | Residual risk |

|---|---|---|

| Content tampering | Hash verification (recompute blockHash) | None — any change is detectable |

| Fake attribution | Lineage is structural, not declared | Attacker can create blocks with misleading content, but graph structure is verifiable |

| Replay of signed requests | Nonce + expiry + domain scoping | Replay possible if verifier omits nonce checks |

| Front-running platform registration | First-registrar-wins documented | Squatting on platform IDs is possible |

| Oversized artifacts | Canonicalization depth limit (128) | Deep nesting rejected; content size is application-level |

| Cycle injection | O(V+E) cycle detection | Cycles detected and reported |

| Hash collision | Keccak-256 (256-bit) | Computationally infeasible with current technology |

## Content Governance

ALX excludes reading, scanning, or filtering `content`. The protocol cannot determine whether a Block contains personal identifiable information, regulated data, or content that violates a data governance policy.

Content inspection and policy enforcement must occur before calling `createBlock`. Once locked, the `blockHash` binds to the exact content bytes. A locked Block cannot be modified without changing identity and producing a new `blockHash`.

Responsibilities at the application layer, before Block creation:

- PII and sensitive data detection (DLP)

- Data residency and sovereignty checks

- Regulatory field restrictions (GDPR, HIPAA, SOC 2 data classification, and equivalents)

- Content classification and labeling

- Consent and purpose-limitation verification

ALX verifies that locked content matches its locked hash. The application layer determines whether the content is appropriate to lock.

ALX excludes DLP functionality. The protocol provides no content filtering, PII detection, or regulatory classification.

## Verification Boundary Summary

> ALX verifies that an artifact is well-formed, authentically hashed, structurally consistent, and deterministically attributable. Truth, fairness, and usefulness of claims inside the artifact remain outside protocol verification scope.

The scope fits verification infrastructure. Truth verification requires domain-specific oracles, human judgment, or AI evaluation — all of which remain outside the protocol layer.

## Related Documents

- [`whitepaper.md`](./whitepaper.md#part-vii--ecosystem-coordination) — optional ecosystem services and open-world validation (Part VII)

- [`integrators/attributed-outputs.md`](./integrators/attributed-outputs.md) — open-world validation mode for external `parentHashes`

- [`SECURITY.md`](../SECURITY.md) - repository security policy

- [`protocol/spec.md`](../protocol/spec.md) Section 7 (Boundaries) and Section 8 (Non-Goals)

