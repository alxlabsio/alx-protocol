# ADR-009: Graph Validation Model

The architecture decision proposes the ALX Protocol Graph validation model.

---

## Context

ALX Protocol v1 already defines a stable Block identity model:

```text
Block = { blockHash, contentHash, parentHashes, content, protocolVersion }
```

Protocol v1 also already defines:

- Keccak-256 as the only supported hash algorithm
- `0x`-prefixed 64-character lowercase hexadecimal hashes
- closed-world Graph behavior in which unresolved required parents are reported as unavailable data

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
- an unavailable syntactically valid required parent makes the validation outcome `incomplete`, not `invalid`
- a verifier MUST NOT silently reinterpret a missing parent as an external boundary

### 3. Open-World Validation Requires Explicit Verification Context

Open-world validation is permitted only when an explicit verification context declares that mode and identifies external parent boundaries.

Under open-world validation:

- missing parents MAY be outside the required scope only when explicitly declared as external parents in the verification context
- undeclared missing parents remain required data and make the validation outcome `incomplete`
- applications MUST distinguish partial validation from full Graph verification

### 4. External Parents Are Explicit Boundaries, Never Inferred

An external parent is a parent hash intentionally outside the required supplied validation boundary.

A missing syntactically valid parent is unavailable data, not an independent protocol violation. An explicit external declaration determines whether that unavailable parent is outside the required open-world scope.

The v1 Verification Context represents an external parent boundary with:

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

- Missing required parents produce `incomplete` by default.
- External parents are never inferred from absence alone.
- Partial Graph validation requires explicit context.
- Full Graph verification and partial validation remain separate claims.
- v1 Block identity remains stable and compatible with existing vectors and implementations.
- Future hash migration remains a deliberate later-version design problem rather than an accidental v1 change.
- Open-world behavior has an explicit context without polluting the v1 Block primitive; mixed-version behavior remains deferred.

## Resolution Status

V1 now includes the Verification Context schema, portable Graph request and result schemas, closed-world and open-world rules, external-parent boundaries, outcome vectors, and maintained implementations. Full mixed-version Graph semantics and hash agility remain deferred to a future protocol version.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../governance/evolution-and-graph-completeness.md`](../governance/evolution-and-graph-completeness.md)
- [`../governance/versioning.md`](../governance/versioning.md)
- [`../governance/migration.md`](../governance/migration.md)
- [`../governance/stability.md`](../governance/stability.md)
