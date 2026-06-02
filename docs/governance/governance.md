# Governance

This document explains governance process for protocol changes. Stewardship policy and transition milestones are in [`../../GOVERNANCE.md`](../../GOVERNANCE.md). This document does not define protocol behavior.

---

## Decision Authority

| Scope | Authority | Process |
|---|---|---|
| Protocol specification (`protocol/spec.md`) | Protocol maintainers | RFC process (see below) |
| Test vectors (`protocol/test-vectors/`) | Protocol maintainers | Requires spec alignment |
| Reference implementations | Implementation maintainers | Must pass conformance |
| Documentation (`docs/`) | Any contributor | Standard PR process |
| CLI and tooling (`cli/`, `conformance/`) | Any contributor | Standard PR process |

---

## Change Classification

All changes MUST declare impact:

| Classification | Definition | Process |
|---|---|---|
| **Breaking** | Alters protocol behavior or existing test vector outputs | RFC required. Protocol version increment. All implementations must update. |
| **Additive** | Introduces new behavior without affecting existing guarantees | PR with spec update. New test vectors required. |
| **Refactor** | No behavioral change | Standard PR. Tests must continue to pass. |

---

## RFC Process

Protocol-level changes (breaking or significant additive) follow this process:

1. **Proposal** - Open a GitHub Issue with the `rfc` label describing the change, motivation, and impact
2. **Discussion** - Minimum 7-day comment period for community feedback
3. **Specification** - Author produces updated spec language with MUST/SHOULD/MAY requirements
4. **Test vectors** - Author provides new or updated test vectors that exercise the change
5. **Reference implementation** - At least one implementation demonstrates the change
6. **Approval** - Protocol maintainers review and merge
7. **Version bump** - Protocol version incremented if breaking

---

## Conformance Requirements For Changes

- Any change to `protocol/spec.md` that alters required behavior MUST include updated test vectors
- Any new test vector MUST pass in all reference implementations before merge
- Changes that break existing core test vector outputs MUST increment the protocol version
- Companion docs (`docs/`) MUST NOT introduce new normative requirements (see spec.md Normative Scope)
- Core conformance is defined by [`protocol/suites.json`](../../protocol/suites.json); optional extensions use separate extension suites

---

## Contribution Guidelines

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for:

- Scope of allowed changes
- PR requirements
- Design principles

---

## Maintainers

| Role | Scope |
|---|---|
| Protocol maintainers | `protocol/`, `protocol/test-vectors/`, version policy |
| Implementation maintainers | `reference-implementations/`, conformance adapters |
| Documentation maintainers | `docs/`, `artifact-packages/`, `README.md` |
| Tooling maintainers | `cli/`, `conformance/` |

---

## Versioning

See [`versioning.md`](./versioning.md) for the complete versioning policy covering protocol version, SDK versions, and test vector versions.

---

## Security

See [`SECURITY.md`](../../SECURITY.md) for the vulnerability reporting process.

---

## Related Documents

- [`../../GOVERNANCE.md`](../../GOVERNANCE.md) — stewardship model, conformance as governance, architectural constraints
- [`versioning.md`](./versioning.md) — protocol and SDK versioning policy
- [`stability.md`](./stability.md) — stability tiers and deprecation policy
- [`security.md`](./security.md) — threat model and security assumptions
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — contribution scope and PR requirements
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative specification
