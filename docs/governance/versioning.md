# ALX Protocol Versioning Policy

The document explains versioning policy. Versioning policy remains outside the protocol specification.

---

This document defines the versioning policy for the ALX Protocol, its test vectors, and conforming implementations.

## Protocol Version

The canonical protocol version is an integer stored in `protocol/VERSION`.

The protocol version MUST be incremented when the specification changes in a way that produces different outputs for the same inputs. Examples of changes that require a version bump:

- Adding a new required operation
- Changing canonicalization rules
- Changing hash algorithms or normalization behavior
- Altering lineage validation or attribution tracing logic

The protocol version MUST NOT be incremented for changes that do not affect output behavior. Adding new test vectors, clarifying prose in the spec, or adding optional informational fields are not version bumps.

## Test Vector Version

Test vectors are tied to the protocol version. Each vector file MUST include the targeted protocol version.

New vectors MAY be added within a protocol version (additive changes). However, changing the expected output of an existing vector constitutes a behavioral change and MUST be accompanied by a protocol version bump.

## SDK And Implementation Versions

SDKs and other implementations use independent semver versioning. An SDK at v2.3.1 might implement protocol v1. No required relationship exists between an SDK's semver version and the protocol version the SDK targets.

Each SDK MUST expose an `ALX_PROTOCOL_VERSION` constant (or language-appropriate equivalent) indicating the protocol version the SDK conforms to.

## Compatibility Guarantees

Implementations targeting the same protocol version MUST produce byte-identical outputs for the same inputs across all protocol-level operations (canonicalization, hashing, normalization, lineage validation, attribution tracing).

SDKs MAY add convenience methods, helper utilities, or ergonomic wrappers without bumping the protocol version, provided the additions leave protocol-level behavior unchanged.

SDKs MUST NOT change protocol-level behavior without a corresponding protocol version bump.

## Mixed-Version Graphs

Blocks created under different protocol versions MAY appear in the same structural Graph because parent references are opaque hashes. Full cryptographic verification of such a Graph requires version-aware verification context that identifies which protocol rules apply to each Block or Graph segment.

Protocol v1 Blocks are versionless. A verifier MUST NOT infer mixed-version compatibility from the Block alone once multiple protocol versions exist.

See [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) for the accepted architecture that future normative work must follow.

## Breaking Change Policy

Any change that alters the output of the following operations for the same input is a breaking change:

- Canonicalization
- Hashing
- Normalization
- Lineage validation
- Attribution tracing

Breaking changes MUST increment the protocol version. There are no exceptions to this rule.

## Related Documents

- [`./migration.md`](./migration.md) - upgrade procedures
- [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) - accepted long-lived evolution model
