# ADR-001: Graph Validation Model

The architecture decision proposes the ALX Protocol Graph validation model.

---

## Context

ALX Protocol v1 already defines a stable Block identity model:

```text
Block = { blockHash, contentHash, parentHashes, content }
```

Protocol v1 also already defines:

- Keccak-256 as the only supported hash algorithm
- `0x`-prefixed 64-character lowercase hexadecimal hashes
- closed-world Graph behavior in the current implementations, where unresolved parent references are rejected

As ALX evolves toward long-lived, cross-system workflows, several future concerns need a safe architectural baseline:

- partial Graph availability
- external parents
- mixed-version Graphs
- future protocol evolution without guessing or silently weakening verification claims

These concerns require explicit boundaries. Inference from missing data is invalid.

## Decision

### 1. ALX v1 Remains Fixed To The Current Hash Model

ALX v1 remains fixed to:

- Keccak-256
- the existing `0x` hash format

Hash agility is deferred to a future protocol version.

ALX v1 MUST NOT change hash identifiers, hash prefixes, or Block identity semantics as part of the graph-validation hardening pass.

### 2. Closed-World Validation Is The Default v1 Model

ALX v1 uses **closed-world validation** by default.

Under closed-world validation:

- every referenced parent MUST be present within the supplied validation boundary
- unresolved parent references are invalid for that validation claim
- a verifier MUST NOT silently reinterpret a missing parent as an external boundary

### 3. Open-World Validation Requires Explicit Verification Context

Open-world validation is permitted only when an explicit verification context declares that mode and identifies external parent boundaries.

Under open-world validation:

- missing parents MAY be accepted only when explicitly declared as external parents in the verification context
- undeclared missing parents remain invalid
- applications MUST distinguish partial validation from full Graph verification

### 4. External Parents Are Explicit Boundaries, Never Inferred

An external parent is a parent hash intentionally outside the supplied validation boundary.

A missing parent is invalid unless explicitly declared as an external parent under open-world validation.

At minimum, a future verification context for external parents should be able to represent:

```json
{
  "hash": "0x...",
  "reason": "external-boundary",
  "declaredBy": "verification-context",
  "requiredForFullValidation": true
}
```

### 5. Mixed-Version Graphs Are Not Implicitly Valid In v1

ALX v1 Graphs are single-version by default.

Mixed-version Graphs are invalid in v1 unless wrapped in a future supported verification envelope or verification context that explicitly defines the applicable mixed-version semantics.

Older verifiers MUST NOT guess the rules for unknown-version material or silently accept unknown-version material as valid under v1.

## Consequences

- Missing parents are invalid by default.
- External parents are never inferred from absence alone.
- Partial Graph validation requires explicit context.
- Full Graph verification and partial validation remain separate claims.
- v1 Block identity remains stable and compatible with existing vectors and implementations.
- Future hash migration remains a deliberate later-version design problem rather than an accidental v1 change.
- Future open-world or mixed-version behavior has a clear place to be declared without polluting the v1 Block primitive.

## Deferred Decisions

The following remain deferred from this ADR:

- a concrete verification context schema
- a concrete Graph envelope wire format
- a normative open-world verifier API
- full mixed-version Graph semantics
- a future hash-agility migration procedure

Those should be defined in follow-on specifications or ADRs after this v1 baseline is accepted.

## Follow-On Work

1. Define a concrete verification context / envelope format.
2. Add normative spec text for:
   - closed-world validation
   - explicit open-world mode
   - external parent boundaries
   - mixed-version rejection by default in v1
3. Add conformance vectors only after those semantics are finalized.
4. Keep future hash-agility work in a later-version migration track rather than reopening v1 identity.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md)
- [`./versioning.md`](./versioning.md)
- [`./migration.md`](./migration.md)
- [`./stability.md`](./stability.md)
