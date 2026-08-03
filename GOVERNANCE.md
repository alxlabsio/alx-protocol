# Governance

**Status:** Repository governance policy
**Audience:** Contributors, maintainers, and protocol reviewers
**Authority:** Governs stewardship and repository decision processes; canonical protocol sources govern protocol behavior
**Last reviewed:** 2026-08-01

This document describes ALX Protocol stewardship, decision tiers, and conformance as governance. RFC process details live in [`docs/governance/governance.md`](./docs/governance/governance.md). This document does not define protocol behavior.

---

## Purpose

This document explains who stewards ALX Protocol, how protocol-critical changes are classified and reviewed, and how conformance test vectors act as governance for core Block validity.

## Scope

This document covers:

- Stewardship model and separation from Xandr Labs commercial product work
- Decision tiers (protocol-critical, additive, application-layer)
- Change classification for pull requests
- conformance as governance (core vectors and suites)
- Stewardship transition milestones
- Architectural constraints enforced by the specification

## Non-Goals

This document does not cover:

- Operational RFC steps and maintainer role tables — see [`docs/governance/governance.md`](./docs/governance/governance.md)
- Day-to-day contribution mechanics — see [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Normative protocol rules — see [`protocol/spec.md`](./protocol/spec.md)
- Vulnerability reporting — see [`SECURITY.md`](./SECURITY.md)

---

## Stewardship Model

ALX Protocol is maintained by ALX Foundation, a nonprofit organization. The steward role covers:

- The normative specification and schemas (`protocol/spec.md`, `protocol/schemas/`)
- Canonical conformance test vectors and materials (`protocol/test-vectors/`, `conformance/`)
- Protocol governance and documentation
- Designation of non-normative reference implementations

The specification, test vectors, reference implementations, and associated tooling are
MIT-licensed. Anyone can fork, reimplement, or extend ALX Protocol without permission
or coordination with ALX Foundation or Xandr Labs.

Xandr Labs is the founding contributor to ALX Protocol and develops implementations,
tooling, applications, services, and supporting infrastructure for the ALX ecosystem.
Commercial products, applications, ecosystem services, and economic mechanisms—including
those developed by Xandr Labs—do not determine or alter ALX Protocol conformance.

---

## Decision-Making Process

Changes to ALX fall into three tiers with different review requirements. Operational RFC steps are in [`docs/governance/governance.md`](./docs/governance/governance.md).

### Protocol-critical changes (core)

Changes to core hashing, canonicalization, schemas, Block identity, or attribution
computation are protocol-critical. Protocol-critical changes require:

1. **Public proposal** — GitHub Issue with the `rfc` label, or a PR with detailed rationale
2. **Impact assessment** — explicit declaration of what breaks and what doesn't
3. **Updated test vectors** — new or modified vectors in `protocol/test-vectors/`
4. **Cross-implementation verification** — all three reference implementations
   (TypeScript, Rust, Python) must pass the updated vectors before merge
5. **Review period** — minimum 7-day comment window for community feedback
6. **Version bump** — protocol version increment on merge when outputs change

Optional extensions (Content Envelope profile, Merkle, and signing) follow the same RFC discipline with extension manifests and extension-specific verification. Extension changes do not redefine core Block validity.

### Additive changes

New adapters, new signing algorithms, new storage backends, and new CLI commands
introduce capabilities without altering existing behavior. Additive changes follow standard
PR review:

- Spec update if the addition touches protocol surface
- New test vectors for any new guarantees
- No version bump required when existing core vector outputs are unchanged

### Application-layer changes

Documentation, CLI UX, and CI configuration are at maintainer
discretion. Standard PR process applies; no RFC or review period required.

---

## Change Classification

Every PR must declare its impact category:

| Classification | Scope | Examples |
|---|---|---|
| **Breaking** | Changes protocol-visible behavior | Hash algorithm change, canonicalization rule change, schema field rename, core test vector output change |
| **Additive** | New capability, no effect on existing behavior | New signing algorithm, new storage adapter, new CLI command, new extension suite |
| **Refactor** | No protocol-visible effect | Internal code restructuring, dependency updates, documentation fixes |

Breaking changes that alter existing core test vector outputs require a protocol
version increment. Additive changes require new test vectors but no version bump when
existing outputs are unchanged. Refactors require only that existing tests continue to pass.

---

## Test Vectors as Governance

The required core test vectors and conformance suites listed in [`protocol/suites.json`](./protocol/suites.json) serve as the primary governance mechanism for **core** ALX validity. The vectors cover:

- Canonical JSON serialization (float normalization, Unicode handling, key ordering)
- Keccak-256 Block identity derivation (`blockHash`, `contentHash`)
- `parentHashes` normalization and parent limits
- Attribution Trace computation (`pathCount`, reachability)
- Lineage and Graph validation (negative and boundary cases)
- Semantic integrity checks on Block structure

Optional extensions remain outside core conformance. Merkle and signing have extension conformance suites; the Content Envelope profile is schema-only.

**Any implementation that passes all required core test vectors is conformant.** There is no
certification process, no registry of approved implementations, and no authority
that grants or revokes conformance status. The vectors are deterministic and
self-verifying.

**Any change that causes existing core test vectors to produce different outputs is
breaking by definition.** Cross-implementation CI enforces this; it is not a committee judgment call.

The test vectors are ALX Protocol's authoritative definition — independent of
any particular implementation or maintainer's interpretation.

---

## Stewardship Transition Plan

Stewardship transition is tied to concrete adoption milestones, not timelines.
The goal is straightforward: as independent usage grows, control transfers to
the implementer community.

### Current state: single steward

ALX Foundation maintains the specification, schemas, canonical test vectors, conformance
materials, and protocol governance. Xandr Labs develops reference implementations and
participates as the founding contributor. Decision authority follows the process described above.

### At 3+ independent implementations

When three or more conformant implementations exist independently of ALX Foundation and Xandr Labs:

- Establish an **advisory board** with representation from independent
  implementers
- Advisory board gains review authority over protocol-critical changes
- ALX Foundation retains merge authority but commits to not merging over
  advisory board objections

### At 5+ independent implementations or standards body interest

When five or more independent implementations exist, or a recognized standards
body (W3C, IETF, or equivalent) expresses formal interest:

- ALX Foundation may transfer or delegate standards stewardship to a recognized standards
  body or community-governed successor
- ALX Foundation and Xandr Labs participate through the receiving body's established process,
  with no unilateral veto power
- Governance transitions to the receiving body's established process

### Regardless of stewardship

The stewardship transition commitments survive any transition:

- The specification and test vectors remain MIT-licensed
- No steward, successor foundation, or standards body may impose licensing restrictions
  on ALX Protocol
- Xandr Labs retains no special governance authority by virtue of its founding-contributor status

---

## Architectural Constraints

The architectural constraints are structural properties enforced by
the specification and test vectors, not policy decisions. Changing any constraint would require a
breaking protocol revision.

1. **No token mechanics.** ALX Protocol does not define, reference, or require
   any token, coin, or economic incentive. ALX Protocol defines no fee, stake, or reward
   at the protocol layer.

2. **No hosted service dependency.** ALX Protocol does not require any hosted
   service, API endpoint, or centralized infrastructure to function. Any conformant
   implementation can operate fully offline.

3. **No blockchain requirement.** On-chain anchoring is optional. ALX Protocol
   operates identically whether Blocks are anchored to Base, another chain,
   or no chain at all.

4. **No content inspection.** ALX Protocol verifies structure, identity, and
   lineage. ALX Protocol does not interpret, evaluate, or filter content. A conformant
   implementation cannot distinguish a research paper from a grocery list.

The architectural constraints exist because ALX Protocol is a verification layer, not an application
platform. Removing any constraint would compromise ALX Protocol utility as neutral
infrastructure.

---

## Community Participation

- **Issues and PRs**: [github.com/xandrlabs/alx-protocol](https://github.com/xandrlabs/alx-protocol)
- **Discussions**: GitHub Discussions on the same repository
- **Security disclosures**: `security@xandrlabs.ai` (see [SECURITY.md](./SECURITY.md))
- **Contributing**: see [CONTRIBUTING.md](./CONTRIBUTING.md) for scope, PR requirements, and design principles

Anyone can implement ALX Protocol in any language. Protocol conformance — passing the required core test
vectors — is the only requirement. No registration, no approval, no
coordination with ALX Foundation or Xandr Labs.

---

## Related Documents

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution scope and PR requirements
- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting
- [`docs/governance/governance.md`](./docs/governance/governance.md) — RFC process and maintainer roles
- [`docs/governance/stability.md`](./docs/governance/stability.md) — stability tiers and deprecation policy
- [`docs/governance/versioning.md`](./docs/governance/versioning.md) — protocol and SDK versioning
- [`protocol/spec.md`](./protocol/spec.md) — normative specification
- [`protocol/suites.json`](./protocol/suites.json) — core and extension conformance suite manifest
