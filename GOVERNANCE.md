# Governance

This document defines ALX Protocol governance. This document does not define protocol behavior.

---

## Purpose

This document defines:

* protocol stewardship;
* protocol authority;
* change classification;
* protocol-critical review requirements;
* conformance governance;
* architectural constraints;
* stewardship transition conditions;
* community participation.

RFC procedures are defined in [`docs/governance/protocol-change-process.md`](./docs/governance/protocol-change-process.md).

---

## Protocol Stewardship

ALX Foundation is the steward of ALX Protocol.

ALX Foundation maintains:

* normative protocol sources;
* canonical conformance materials;
* protocol governance;
* protocol releases;
* reference implementation designations.

ALX Labs is the founding contributor.

ALX Labs develops and maintains:

* implementations;
* tooling;
* applications;
* services;
* supporting infrastructure.

ALX Labs products, applications, services, and economic mechanisms do not determine ALX Protocol conformance.

The protocol specification, canonical conformance materials, reference implementations, and associated tooling are MIT-licensed.

Independent implementations and extensions do not require permission from ALX Foundation or ALX Labs.

---

## Protocol Authority

Normative protocol behavior is governed collectively by:

* [`protocol/spec.md`](./protocol/spec.md);
* [`protocol/schemas/`](./protocol/schemas/);
* [`test-vectors/`](./test-vectors/);
* identifiers defined in [`protocol/error-codes.json`](./protocol/error-codes.json).

[`protocol/suites.json`](./protocol/suites.json) identifies required conformance suites.

`protocol/spec.md` defines protocol requirements.

`protocol/schemas/` defines machine-readable protocol structures and constraints.

`test-vectors/` defines canonical conformance inputs and expected outputs for covered behavior.

`protocol/error-codes.json` defines canonical protocol error identifiers.

Implementations, documentation, examples, tooling, and extensions MUST conform to these sources.

A conflict among normative sources requires protocol governance review.

Dependent protocol changes MUST NOT proceed until the conflict is resolved.

---

## Change Classification

Every protocol change MUST declare one classification.

| Classification | Definition                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Breaking**   | Changes existing protocol-visible behavior or guarantees                                                   |
| **Additive**   | Introduces behavior while preserving existing protocol-visible behavior and guarantees                     |
| **Refactor**   | Changes implementation, tooling, or documentation without changing protocol-visible behavior or guarantees |

A change is **breaking** when it changes:

* Block identity derivation;
* canonicalization behavior;
* required schema behavior;
* an existing `contentHash` output;
* an existing `blockHash` output;
* `parentHashes` normalization;
* Graph validity;
* Trace computation;
* an existing canonical core test-vector output;
* an existing protocol guarantee.

An **additive** change MUST preserve existing protocol-visible behavior, guarantees, and canonical core test-vector outputs.

A **refactor** MUST preserve protocol-visible behavior, guarantees, and canonical core test-vector outputs.

Version requirements are defined in [`docs/governance/versioning.md`](./docs/governance/versioning.md).

---

## Protocol-Critical Changes

A change is protocol-critical when it modifies:

* canonicalization;
* hash derivation;
* Block identity;
* required Block structure;
* `parentHashes` normalization;
* Graph validity;
* lineage behavior;
* Trace computation;
* canonical core test vectors;
* another core protocol guarantee.

A protocol-critical change requires:

1. a public proposal;
2. an impact assessment;
3. identification of affected invariants;
4. identification of affected normative sources;
5. updates to affected normative sources;
6. updated or additional canonical test vectors;
7. cross-implementation conformance;
8. a minimum seven-day public review period;
9. the applicable protocol version change.

The public proposal MUST identify the requested behavior and affected protocol surface.

Cross-implementation verification MUST include the TypeScript, Rust, and Python implementations.

A protocol-critical change MUST NOT merge before the required review period and verification are complete.

---

## Canonical Test-Vector Changes

A change to an existing canonical core test-vector output is a breaking change.

A correction to an existing canonical vector MUST identify the normative requirement that requires the correction.

A vector correction requires:

* identification of the affected normative source;
* documented reason for the correction;
* updated conformance material;
* cross-implementation verification;
* public review;
* the version change required by repository policy.

Implementation-specific output MUST NOT replace canonical expected output without protocol governance review.

---

## Additive Changes

An additive change introduces behavior while preserving existing core protocol behavior and guarantees.

Additive changes include:

* new protocol-defined optional capabilities;
* new signing algorithms;
* new storage adapters;
* new CLI capabilities;
* new extension conformance cases.

An additive protocol-visible change MUST:

* preserve existing canonical core test-vector outputs;
* update applicable normative sources;
* include tests for introduced behavior;
* include conformance cases for introduced protocol requirements or guarantees.

Optional extensions MUST NOT redefine core Block validity.

---

## Application-Layer Changes

An application-layer change does not modify core protocol behavior or guarantees.

Application-layer changes include:

* explanatory documentation;
* CLI presentation;
* storage integrations;
* application adapters;
* CI configuration;
* repository tooling.

Application-layer changes follow the standard repository review process.

A change that modifies a protocol-critical dependency, invariant, or conformance requirement MUST follow the protocol-critical change process.

---

## Conformance

An implementation is conforming when it:

* satisfies all applicable normative protocol requirements;
* passes all required core conformance suites;
* produces required outputs for canonical test vectors;
* rejects invalid inputs where required by the protocol.

Core conformance includes the requirements identified by [`protocol/suites.json`](./protocol/suites.json).

Core conformance covers applicable:

* canonicalization;
* Block identity derivation;
* `parentHashes` normalization;
* Block validation;
* Graph validation;
* lineage behavior;
* Trace computation;
* negative cases;
* boundary cases.

Optional extensions are not part of core Block validity.

Each protocol-defined extension defines its applicable specification, manifest, and conformance requirements.

Conformance does not require registration, certification, or approval by ALX Foundation, ALX Labs, or an implementation provider.

---

## Conformance Governance

Canonical test vectors define conformance inputs and expected outputs for the behavior they cover.

Canonical test vectors MUST conform to the applicable normative protocol requirements.

Implementations MUST produce the canonical output defined for each applicable vector.

Implementation-specific behavior does not modify protocol requirements.

An implementation disagreement with a canonical vector requires review of:

1. the applicable requirement in `protocol/spec.md`;
2. the applicable schema;
3. the canonical test vector;
4. the implementation behavior.

When the normative sources and canonical vector specify the same behavior, the implementation MUST conform to that behavior.

When normative sources conflict, maintainers MUST resolve the conflict through protocol governance before changing dependent protocol behavior.

---

## Reference Implementations

ALX Protocol maintains reference implementations in TypeScript, Rust, and Python.

Reference implementations provide:

* implementation examples;
* interoperability evidence;
* cross-language conformance evidence.

Reference implementation behavior does not define protocol behavior.

A disagreement among reference implementations MUST be resolved against the normative protocol sources and canonical conformance materials.

No reference implementation has independent authority to modify protocol requirements.

---

## Optional Extensions

Optional extensions operate outside core Block validity unless a protocol revision explicitly changes that boundary.

Protocol-defined extensions MUST:

* identify their scope;
* identify applicable normative sources;
* preserve core Block validity;
* define conformance requirements when interoperable behavior is specified.

Extension changes MUST NOT modify core Block identity, canonicalization, Graph validity, or other core guarantees unless processed as a breaking protocol change.

---

## Architectural Constraints

The following constraints define core ALX Protocol.

A change to an architectural constraint is a breaking protocol change.

### No Token Mechanics

Core ALX Protocol does not define or require:

* a token;
* a coin;
* a fee;
* a stake;
* a reward;
* an economic incentive.

Economic mechanisms MAY reference ALX Blocks outside the core protocol.

Economic mechanisms MUST NOT affect core Block validity.

### No Hosted Service Dependency

Core Block creation and verification MUST NOT require:

* a hosted service;
* a vendor API;
* a registry;
* centralized infrastructure.

A conforming implementation MUST support core Block creation and verification through local computation over required protocol data.

### No Blockchain Requirement

Core ALX Protocol does not require a blockchain.

Anchoring MAY operate as an external mechanism or optional extension.

Anchoring MUST NOT affect core Block validity.

### No Content Interpretation

Core ALX Protocol treats Block `content` as opaque application data constrained to the ALX value model.

Core protocol verification does not determine:

* semantic meaning;
* factual accuracy;
* authorship;
* originality;
* content quality;
* ownership;
* legal status;
* policy compliance;
* economic value;
* reward eligibility.

Applications and external systems determine these properties.

---

## Stewardship Transition

Stewardship transition is triggered by the conditions defined in this section.

### Current State

ALX Foundation is the protocol steward.

ALX Labs is the founding contributor and an implementation maintainer.

ALX Foundation holds merge authority for canonical protocol materials under the governance process defined by this repository.

### Three Independent Implementations

This transition condition is met when at least three conforming implementations are maintained independently of ALX Foundation and ALX Labs.

When this condition is met:

* ALX Foundation MUST establish an advisory board;
* the advisory board MUST include independent implementer representation;
* the advisory board receives review authority over protocol-critical changes;
* ALX Foundation retains repository merge authority;
* ALX Foundation MUST NOT merge a protocol-critical change over a formal advisory board objection.

### Five Independent Implementations or Standards Process

This transition condition is met when:

* at least five conforming implementations are maintained independently of ALX Foundation and ALX Labs; or
* a recognized standards body initiates a formal ALX Protocol standardization process.

When this condition is met, ALX Foundation MAY transfer or delegate protocol stewardship to a recognized standards body or community-governed successor.

Following a transfer:

* governance follows the receiving body's documented process;
* ALX Foundation participates through that process;
* ALX Labs participates through that process;
* founding-contributor status grants no independent governance authority.

### Transition Requirements

A stewardship transition MUST preserve:

* public access to the protocol specification;
* public access to canonical conformance materials;
* existing open-source licensing commitments;
* independent implementation rights.

Founding-contributor status does not grant permanent protocol authority.

---

## Governance Records

Protocol-critical governance decisions MUST have a public repository record.

The record MUST identify:

* the proposed change;
* change classification;
* affected normative sources;
* affected invariants;
* review outcome;
* conformance status;
* version impact.

Protocol releases MUST be recorded through the repository release process.

Revision history is maintained in [`CHANGELOG.md`](./CHANGELOG.md).

---

## Community Participation

Protocol development occurs through the public repository.

Participants may:

* submit issues;
* submit pull requests;
* participate in RFC review;
* implement ALX Protocol independently;
* develop optional extensions;
* review protocol-critical proposals.

Protocol conformance is determined by normative protocol requirements and required conformance suites.

Implementation does not require registration or approval.

---

## Security

Security vulnerabilities are governed by [`SECURITY.md`](./SECURITY.md).

Security reports MUST use the disclosure process defined in that document.

Security findings that require protocol-visible changes MUST follow the applicable protocol governance process.

Operational security intake is administered by ALX Labs.

---

## Related Documents

* [`protocol/spec.md`](./protocol/spec.md) — normative protocol specification
* [`protocol/schemas/`](./protocol/schemas/) — normative schemas
* [`test-vectors/`](./test-vectors/) — canonical test vectors
* [`protocol/error-codes.json`](./protocol/error-codes.json) — canonical error identifiers
* [`protocol/suites.json`](./protocol/suites.json) — conformance suite manifest
* [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution requirements
* [`SECURITY.md`](./SECURITY.md) — vulnerability reporting
* [`MAINTAINERS.md`](./MAINTAINERS.md) — maintainer responsibilities
* [`PUBLICATION.md`](./PUBLICATION.md) — publication identity and lifecycle
* [`docs/governance/protocol-change-process.md`](./docs/governance/protocol-change-process.md) — RFC process
* [`docs/governance/stability.md`](./docs/governance/stability.md) — stability and deprecation policy
* [`docs/governance/versioning.md`](./docs/governance/versioning.md) — protocol and SDK versioning
* [`CHANGELOG.md`](./CHANGELOG.md) — revision history
