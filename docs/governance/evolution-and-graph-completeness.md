# Protocol Evolution And Graph Completeness

Evolution and Graph completeness decisions for ALX Protocol.

---

## Purpose

Define how ALX should evolve beyond protocol v1 without weakening the current architectural invariants:

- the Block remains the minimal trust primitive
- protocol evolution is explicit rather than inferred
- mixed-version material can be represented while marking verification scope explicitly
- partial graphs can be handled while preserving incompleteness as a distinct claim from invalidity
- optional extensions remain optional and independently versioned

## Accepted Decisions

### 1. The v1 Block Remains Minimal And Versionless

Protocol v1 Blocks remain:

```text
{ blockHash, contentHash, parentHashes, content }
```

The v1 Block shape MUST NOT be expanded to carry protocol-version, external-parent, storage, or transport metadata. Those concerns belong in verification context outside the Block primitive.

**Reasoning:** Adding version or availability metadata to the v1 hashed shape would change Block identity and undermine the minimality that v1 is intended to preserve.

### 2. Byte-Size Limits Are Implementation Policy, Outside Core Validity

Canonicalization depth remains a protocol-level limit because depth limits are part of deterministic safety behavior. Canonical byte-size ceilings are local implementation policy unless a future protocol version explicitly makes byte-size ceilings normative.

Protocol validity in v1 is therefore independent of a universal maximum content-byte size.

**Consequences:**

- byte-size ceilings MAY be imposed by SDKs, CLIs, servers, transports, or storage systems
- such ceilings MUST be documented as local operational policy, outside core ALX validity
- byte-size limits MUST NOT appear in core conformance claims unless a future protocol version makes byte-size limits normative

### 3. Mixed-Version Graphs Require Verification Context

Parent references remain opaque Block identifiers, so a Block MAY reference a parent created under a different protocol version.

However, because v1 Blocks are versionless, a verifier cannot infer the correct hashing rules for every Block from the Block alone once multiple protocol versions exist.

Mixed-version verification therefore requires external **verification context** that maps each Block, Graph segment, or envelope to the applicable protocol version and verifier rules.

At minimum, a future version-aware verification context should be able to express:

```text
blockHash -> protocolVersion
protocolVersion -> verifier
```

### 4. Structural Validity, Cryptographic Validity, And Completeness Are Distinct Claims

Future ALX verification APIs and specs SHOULD distinguish:

| Claim | Meaning |
|---|---|
| **Structural validity** | supplied links are well-formed and preserve Graph rules |
| **Cryptographic validity** | each supplied Block validates under the declared protocol rules for that Block |
| **Completeness** | every parent required by the selected validation boundary is available for verification |

A Graph may be structurally valid but incomplete. A Graph may be structurally traceable while cryptographic verification remains pending.

No implementation should collapse all missing material into the single conclusion “invalid” once open-world validation is introduced.

### 5. Closed-World And Open-World Validation Are Different Modes

#### Closed-World Validation

Closed-world validation assumes the supplied Graph boundary is complete.

Under closed-world validation:

- every referenced parent MUST resolve inside the supplied boundary
- unresolved parents make the Graph incomplete for that mode
- full graph verification claims are only valid when all supplied Blocks validate under the applicable rules

Current v1 `validateGraph()` and `verifyGraph()` behavior is closed-world.

#### Open-World Validation

Open-world validation permits intentionally external or currently unavailable parents when the boundary is explicitly declared.

Under open-world validation:

- known supplied material MAY be validated independently
- unresolved parents MUST be reported explicitly
- callers MUST NOT claim full Graph verification unless all required material has been resolved

Open-world validation is a future architectural capability. Open-world validation remains outside protocol v1 core behavior.

### 6. External Parents Are Declared In Verification Context, Not In The Block

An external parent is a parent hash intentionally outside the supplied validation boundary.

External-parent metadata SHOULD live in the verification context or envelope, outside the Block primitive. A future context format may need to declare:

- parent hash
- applicable protocol version, if known
- boundary classification such as external or unavailable
- availability status
- optional explanatory metadata for applications

The Block identity rule is unchanged when a parent is external.

### 7. Mixed-Version Behavior Must Never Be Implied

When multiple protocol versions exist:

- a mixed-version Graph MAY be structurally represented
- a verifier MUST NOT claim cryptographic validity for a Block without applying the correct declared protocol rules
- a verifier that lacks support for a declared version MUST reject full-verification claims for that material or report the version as unsupported
- older verifiers MUST reject silent treatment of unknown-version material as v1-valid

### 8. Protocol v1 Remains Fixed To Keccak-256

ALX protocol v1 uses Keccak-256 only.

Hash agility is a future-version concern. A future protocol version that introduces multiple hash algorithms MUST encode the selected algorithm explicitly rather than relying on hash length or ambient convention.

The v1 migration path is:

1. preserve all v1 Block identities as Keccak-256 identities
2. introduce explicit algorithm identification only in a future protocol version
3. use version-aware verification context to verify mixed-version Graphs during migration

### 9. Extensions Are Independently Versioned

Optional extensions MUST remain outside core conformance and MUST declare a compatibility surface.

Every extension manifest SHOULD include:

```json
{
  "id": "merkle",
  "extensionVersion": "1",
  "lifecycle": "stable",
  "requiredForCore": false,
  "compatibleProtocolVersions": ["1"],
  "suites": [],
  "deprecated": false,
  "supersedes": null
}
```

Recommended lifecycle states:

- `experimental`
- `provisional`
- `stable`
- `deprecated`

An extension that changes outputs for the same inputs MUST increment the extension version. An extension MUST NOT silently become required for core protocol validity.

## Required Follow-On Work

These governance decisions authorize a later normative pass that should:

1. add mixed-version verification semantics to the core specification
2. define current closed-world behavior and reserve future open-world behavior
3. clarify external-parent semantics without changing the v1 Block primitive
4. preserve v1 as Keccak-256-only while documenting the migration path
5. update extension manifests to the versioned lifecycle schema above
6. add conformance vectors only after the normative rules are finalized

## Deferred Specifications

The document intentionally defers:

- a concrete Graph envelope wire format
- a concrete version-aware verifier API
- a normative open-world validation operation
- a v2 Block structure
- the hash format for future algorithm agility

Those belong in later specifications or RFCs once the current architectural constraints are accepted.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`./versioning.md`](./versioning.md)
- [`./migration.md`](./migration.md)
- [`./stability.md`](./stability.md)
- [`../implementers/conformance.md`](../implementers/conformance.md)
