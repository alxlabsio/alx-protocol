# Trust Model

**Document type:** Reference

This page explains what an ALX verification result can and cannot support. Canonical behavior is defined by [`../protocol/spec.md`](../protocol/spec.md); the fuller threat model is [`governance/protocol-security-model.md`](./governance/protocol-security-model.md).

## Verification scope

| Claim | What can be checked locally |
|---|---|
| Block identity | Recompute `contentHash` and `blockHash` from the complete Block |
| Declared relationships | Inspect normalized `parentHashes` and reachable available Blocks |
| Graph status | Execute the requested verification context and report the canonical outcome |
| Trace structure | Reproduce nodes, edges, depths, leaves, and exact `pathCount` values |
| Optional signature | Verify the selected extension/profile signature over its exact payload |
| Optional Merkle proof | Verify inclusion under the extension's root and pair-hashing rules |

The claim is always bounded by the supplied data and Verification Context. Local verification does not imply global observation or complete availability.

## Excluded claims

ALX verification does not establish:

- truth, quality, safety, or originality of `content`;
- authorship, legal identity, ownership, authorization, or policy compliance;
- availability, durability, publication, ordering, or consensus;
- completeness of an application index, crawler, database, or Explorer;
- economic value, contribution weight, settlement entitlement, or fairness; or
- timestamp accuracy merely because a signer supplied a timestamp.

Applications may make those claims only through their own evidence and trust policy.

## Availability and Graph outcomes

References do not guarantee availability. An unavailable syntactically valid required parent produces `incomplete` unless a higher-precedence violation or resource outcome applies. It is not invalid merely because it is missing.

Open-world mode excludes only parents explicitly declared as external in the context. A bounded-depth `valid` result covers only the required checks within that depth.

## Cryptographic assumptions

- V1 identity depends on the collision and preimage resistance of Keccak-256.
- Correctness depends on deterministic, unambiguous canonicalization across implementations.
- Similar hash encodings do not make content, Block, attestation, and Merkle domains interchangeable.
- A valid signature demonstrates control of the corresponding private key for the exact signed payload. External systems bind keys to people, organizations, roles, and permissions.
- External anchoring can provide commitment evidence under the selected network assumptions. It does not validate the submitted Block or prove authorship.

## Application responsibilities

Before Block creation, storage, publication, or execution, applications are responsible for:

- privacy, consent, DLP, malware, and regulated-data controls;
- content and schema policy;
- authorization and identity binding;
- key management, revocation, freshness, and replay state;
- storage access control, retention, replication, and deletion policy;
- source discovery and index coverage; and
- safe handling of untrusted content.

A matching hash is evidence of identity consistency, not permission to trust or execute the content.

## Derived application relationships

Children, descendants, neighborhoods, indexed relationships, and observation metadata are derived by applications from available Blocks. They are not Block fields. Applications should report source scope, index revision, pagination, and truncation separately from protocol Trace completeness.

## Related documents

- [`governance/protocol-security-model.md`](./governance/protocol-security-model.md) — protocol threat model
- [`threat-model.md`](./threat-model.md) — stable security entry point
- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and repository policy
- [`integrators/deployment-checklist.md`](./integrators/deployment-checklist.md) — operational controls
- [`verification-receipts.md`](./verification-receipts.md) — point-in-time verification records
