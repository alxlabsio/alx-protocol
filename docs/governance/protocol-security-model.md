# Protocol Security Model

**Document type:** Reference

This document explains ALX security properties, trust assumptions, and residual risks. Canonical behavior remains governed by [`../../protocol/spec.md`](../../protocol/spec.md). Vulnerability reporting and repository security policy are defined in [`../../SECURITY.md`](../../SECURITY.md).

## Protected properties

Core verification can establish, within the supplied value and verification context:

- deterministic canonicalization;
- agreement between `content` and `contentHash`;
- agreement between `content`, normalized `parentHashes`, and `blockHash`;
- structural violations in examined Blocks and relationships;
- deterministic Graph verification outcomes and Trace construction.

Core verification does not establish content truth, authorship, originality, authorization, legal ownership, confidentiality, availability, publication time, global observation, economic value, or policy compliance.

## Trust boundaries

| Layer | ALX verifies | External responsibility |
|---|---|---|
| Block | Canonical identity and structural validity | Meaning, truth, privacy, authorization |
| Graph | Reachable examined structure under a declared context | Block discovery, source completeness, index coverage |
| Trace | Deterministic structure for the supplied root and Graph | Economic or authorship interpretation |
| Storage and transport | Nothing about backend trust | Availability, retention, access control, replication |
| Optional signing | Signature validity under the selected extension/profile | Key ownership, authorization, freshness, revocation, identity binding |
| Optional anchoring | External commitment evidence | Chain trust, finality policy, correct hash submission, interpretation |

No hosted ALX service, blockchain, registry, indexer, Explorer, or organizational approval is required for core local verification.

## Primary threats

| Threat | Required handling | Residual risk |
|---|---|---|
| Modified Block content or parents | Recompute both hashes and validate the Block | Collision and preimage assumptions of Keccak-256 |
| Malformed or ambiguous raw JSON | Reject malformed UTF-8, duplicate members, and trailing data before canonicalization | Non-JSON transports require equivalent unambiguous ingress rules |
| Invalid, duplicate, or self-referential parents | Apply canonical normalization and Graph rules | Availability of syntactically valid referenced Blocks is external |
| Cyclic reachable Graph | Detect and return a definite violation | Unexamined or out-of-scope candidates make no claim |
| Missing required Block data | Report `incomplete` unless a higher-precedence violation exists | Reverification is needed when availability changes |
| Resource exhaustion | Enforce documented budgets and report `resource_limit_reached` after request acceptance | Service-level denial of service remains operational |
| Nondeterministic traversal or diagnostics | Use canonical ordering and exact result shapes | Implementation defects require conformance and differential testing |
| Malicious Block content | Treat content as opaque after ALX-value validation | Applications must apply privacy, malware, DLP, and policy controls before persistence or execution |

## Cryptographic boundaries

Core identity uses domain-separated Keccak-256 as specified in [`../../protocol/spec.md`](../../protocol/spec.md). Similar textual hash shapes do not make `contentHash`, `blockHash`, attestation digests, and Merkle values interchangeable.

Portable signing suites are optional and currently cover Ed25519 and P-256. The TypeScript SDK also exposes application-oriented EIP-712 and replay helpers; those helpers do not define core conformance or the portable signing-extension claim.

A valid signature proves control of the corresponding private key for the exact signed payload. It does not by itself prove legal identity, authorization, content truth, timestamp freshness, uniqueness, or application permission.

## Availability and observation

ALX references do not guarantee that referenced Blocks are available. Closed-world and open-world contexts define what the verifier was asked to resolve; neither creates a global Graph or discovery service.

Indexes and Explorers may derive children, descendants, neighborhoods, or observation metadata. Those views are application data and must report their own source scope, index revision, pagination, and truncation state rather than reusing protocol Trace completeness.

## Optional contract boundary

The reference `ALXAnchor` contract is an optional external anchoring integration. Contract acceptance does not validate a Block, establish authorship, or make content true. Consumers validate the complete Block locally and apply their own chain-finality and authorization policy.

Contract status and exact behavior are documented in [`../../contracts/README.md`](../../contracts/README.md). The repository must not describe the contract or protocol as independently audited until the status in [`security-review-status.md`](./security-review-status.md) changes through the public review process.

## Operational controls

Implementations and services should apply bounded decoding, collection, traversal, output, memory, time, and cryptographic-work limits. They should avoid logging sensitive Block content, isolate untrusted parsing, use constant-time comparisons where appropriate, and keep secrets outside Blocks and repository configuration.

Run conformance, differential, security, fuzz, and language-specific checks as evidence of implementation quality. These checks are not substitutes for an independent security review.

## Vulnerability reporting

Follow [`../../SECURITY.md`](../../SECURITY.md). Do not publish active findings, exploit details, credentials, or private triage records in public documentation.

## Related documents

- [`../trust-model.md`](../trust-model.md) — user-facing verification boundary
- [`independent-security-review-plan.md`](./independent-security-review-plan.md) — independent-review scope and readiness
- [`security-review-status.md`](./security-review-status.md) — current public review status
- [`../threat-model.md`](../threat-model.md) — stable security navigation entry
- [`../../protocol/extensions/signing/README.md`](../../protocol/extensions/signing/README.md) — portable signing extension
