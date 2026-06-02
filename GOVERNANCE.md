# Governance

This document describes ALX Protocol stewardship, decision tiers, and conformance as governance. RFC process details live in [`docs/governance/governance.md`](./docs/governance/governance.md). This document does not define protocol behavior.

---

## Purpose

This document explains who stewards ALX Protocol, how protocol-critical changes are classified and reviewed, and how conformance test vectors act as governance for core Block validity.

## Scope

This document covers:

- Stewardship model and separation from Xandr Labs commercial product work
- Decision tiers (protocol-critical, additive, application-layer)
- Change classification for pull requests
- Conformance as governance (core vectors and suites)
- Stewardship transition milestones
- Architectural constraints enforced by the specification

## Non-goals

This document does not cover:

- Operational RFC steps and maintainer role tables — see [`docs/governance/governance.md`](./docs/governance/governance.md)
- Day-to-day contribution mechanics — see [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Normative protocol rules — see [`protocol/spec.md`](./protocol/spec.md)
- Vulnerability reporting — see [`SECURITY.md`](./SECURITY.md)

---

## Stewardship Model

ALX Protocol is maintained by [Xandr Labs](https://xandrlabs.ai). The steward role covers:

- The normative specification (`protocol/spec.md`)
- Reference implementations (TypeScript, Rust, Python)
- Conformance test vectors (`protocol/test-vectors/`)
- **ALXAnchor** on Base (optional existence-time; immutable, no proxy). Legacy Base deployments are reference-only — see [`docs/integrators/on-chain-base.md`](./docs/integrators/on-chain-base.md)
- Documentation and CLI tooling

Xandr Labs does not own ALX Protocol. The specification, test vectors, reference
implementations, and all associated tooling are MIT-licensed. Anyone can fork,
reimplement, or extend ALX Protocol without permission or coordination.

Xandr Labs builds developer tooling and infrastructure services on top of ALX Protocol.
Xandr Labs commercial tooling and infrastructure services are commercially motivated and entirely separate from ALX Protocol core validity.

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

Optional extensions (Merkle, signing, IPFS artifact packages) follow the same RFC discipline with extension manifests and extension conformance suites. Extension changes do not redefine core Block validity.

### Additive changes

New adapters, new signing algorithms, new storage backends, and new CLI commands
introduce capabilities without altering existing behavior. Additive changes follow standard
PR review:

- Spec update if the addition touches protocol surface
- New test vectors for any new guarantees
- No version bump required when existing core vector outputs are unchanged

### Application-layer changes

Documentation, examples, CLI UX, and CI configuration are at maintainer
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

## Conformance as Governance

ALX Protocol's **74 core test vectors** across **10 core conformance suites** (see [`protocol/suites.json`](./protocol/suites.json)) serve as the primary governance mechanism for **core** ALX validity. The vectors cover:

- Canonical JSON serialization (float normalization, Unicode handling, key ordering)
- Keccak-256 Block identity derivation (`blockHash`, `contentHash`)
- `parentHashes` normalization and parent limits
- Attribution Trace computation (`pathCount`, reachability)
- Lineage and Graph validation (negative and boundary cases)
- Semantic integrity checks on Block structure

Optional extensions (Merkle, signing, IPFS artifact packages) have separate extension conformance suites. Extension conformance does not define core Block validity.

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

Xandr Labs maintains the spec, all three reference implementations, and the
test vectors. Decision authority follows the process described above.

### At 3+ independent implementations

When three or more conformant implementations exist outside Xandr Labs:

- Establish an **advisory board** with representation from independent
  implementers
- Advisory board gains review authority over protocol-critical changes
- Xandr Labs retains merge authority but commits to not merging over
  advisory board objections

### At 5+ independent implementations or standards body interest

When five or more independent implementations exist, or a recognized standards
body (W3C, IETF, or equivalent) expresses formal interest:

- Transfer spec ownership to an **independent foundation or standards body**
- Xandr Labs becomes one participant among many, with no veto power
- Governance transitions to the receiving body's established process

### Regardless of stewardship

The stewardship transition commitments survive any transition:

- The specification and test vectors remain MIT-licensed
- No steward, foundation, or standards body may impose licensing restrictions
  on ALX Protocol
- Xandr Labs retains no special authority after transition

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

Anyone can implement ALX Protocol in any language. Conformance — passing the required core test
vectors — is the only requirement. No registration, no approval, no
coordination with Xandr Labs.

---

## Related Documents

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution scope and PR requirements
- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting
- [`docs/governance/governance.md`](./docs/governance/governance.md) — RFC process and maintainer roles
- [`docs/governance/stability.md`](./docs/governance/stability.md) — stability tiers and deprecation policy
- [`docs/governance/versioning.md`](./docs/governance/versioning.md) — protocol and SDK versioning
- [`protocol/spec.md`](./protocol/spec.md) — normative specification
- [`protocol/suites.json`](./protocol/suites.json) — core and extension conformance suite manifest
