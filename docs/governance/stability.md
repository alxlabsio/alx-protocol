# Stability Policy

The document explains stability policy. Stability policy remains outside the protocol specification.

---

## Purpose

Define what stability means for ALX Protocol, what guarantees consumers can rely on, and how breaking changes are handled.

## Scope

Covers protocol stability tiers, backwards compatibility, deprecation process, and SDK versioning policy.

---

## Protocol Stability Tiers

Every protocol operation falls into one of three tiers:

| Tier | Guarantee | Change policy |
|------|-----------|---------------|
| **Stable** | Will not change without a major protocol version bump | Breaking changes require a new protocol version, RFC, and migration path |
| **Provisional** | May change with notice in a minor release | Changes are announced at least one minor version before taking effect |
| **Experimental** | No stability guarantees | May be added, changed, or removed at any time |

## Current Classification (Protocol v1)

| Operation | Layer | Tier |
|-----------|-------|------|
| `canonicalizeProtocolJson` | 1 | Stable |
| `deriveBlockHash` | 2 | Stable |
| `deriveContentHash` | 2 | Stable |
| `createBlock` | 2 | Stable |
| `validateBlock` | 2 | Stable |
| `normalizeHash` | 2 | Stable |
| `normalizeHashes` | 2 | Stable |
| `validateLineage` | 3 | Stable |
| `validateGraph` | 3 | Stable |
| `buildGraph` | 3 | Stable |
| `verifyGraph` | 3 | Stable |
| `traceAttribution` | 4 | Stable |
| `buildMerkleTree` | Merkle extension | Stable extension |
| `getMerkleProof` | Merkle extension | Stable extension |
| `verifyMerkleProof` | Merkle extension | Stable extension |
| `signBlock` | Signing | Provisional |
| `verifyBlockSignature` | Signing | Provisional |
| `verifySignedProtocolPayload` | Signing | Provisional |
| `validateReplayWindow` | Replay | Provisional |

Layers 1-4 are **Stable core**. Merkle operations are a **Stable optional extension**: stable for implementations that choose to include Merkle support, and outside the core ALX conformance requirement. Signing and replay operations are **Provisional** — API surface may evolve as EIP-712 best practices mature.

Optional extensions are independently versioned and MUST declare a compatibility surface. Extension lifecycle states and compatibility expectations are defined in [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md).

---

## Backwards Compatibility Guarantee

### Backwards Compatibility Definition

A Stable operation is backwards compatible if:

1. **Existing valid inputs produce identical outputs.** A Block created with SDK v1.0 validates identically with SDK v1.x.
2. **Existing test vectors continue to pass.** No conformant implementation breaks.
3. **Existing data remains valid.** Blocks stored in v1.0 require no re-hashing or migration.

### Breaking Change Triggers

A breaking change is any modification that causes:

- A different `blockHash` for the same content and parents
- A different canonical form for the same input
- A test vector to produce a different expected output
- An existing valid Block to fail validation

Breaking changes require a new major protocol version (e.g., v1 to v2).

### Non-Breaking Change Criteria

- Adding new operations with no effect on existing ones
- Adding optional parameters with backward-compatible defaults
- Performance improvements that preserve output
- Additional error messages for previously undefined behavior

---

## Deprecation Process

1. **Announce** - the operation is marked as deprecated in the changelog and JSDoc
2. **Grace period** - at least one minor SDK release where the deprecated operation still works
3. **Remove** - the operation is removed in the next major SDK release

Deprecated operations are never removed without a documented replacement.

---

## SDK Versioning

SDKs follow [semantic versioning](https://semver.org/):

- **Major** (1.0 to 2.0): breaking API changes or protocol version bump
- **Minor** (1.0 to 1.1): new features, no breaking changes
- **Patch** (1.0.0 to 1.0.1): bug fixes, no API changes

SDK versions are independent of the protocol version. Multiple SDK versions may implement the same protocol version.

| Protocol version | SDK version range | Relationship |
|-----------------|-------------------|--------------|
| 1 | 1.x.x | SDK 1.x implements protocol v1 |
| 2 (future) | 2.x.x | SDK 2.x would implement protocol v2 |

---

## Related Documents

- [`./versioning.md`](./versioning.md) - version policy details
- [`./governance.md`](./governance.md) - RFC process for proposing changes
- [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) - accepted evolution and extension lifecycle model
- [`./migration.md`](./migration.md) - upgrade procedures
- [`../integrators/api-reference.md`](../integrators/api-reference.md) - current API surface
