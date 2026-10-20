# Maintainers

This document defines maintainer responsibilities for ALX Protocol. This document does not define protocol behavior.

---

## Purpose

This document defines:

- protocol stewardship;
- maintainer roles;
- repository authority;
- review responsibilities;
- merge requirements;
- conformance responsibilities;
- release responsibilities;
- security responsibilities;
- conflict-of-interest requirements;
- maintainer appointment and removal.

---

## Protocol Stewardship

ALX Foundation is the steward of ALX Protocol.

ALX Foundation maintains responsibility for:

- normative protocol sources;
- canonical conformance materials;
- protocol governance;
- protocol releases;
- reference implementation designations;
- stewardship transitions.

ALX Labs is the founding contributor.

ALX Labs develops and maintains:

- reference implementations;
- SDKs;
- CLI tooling;
- repository infrastructure;
- applications;
- services;
- supporting infrastructure.

ALX Labs products, applications, services, and economic mechanisms do not determine ALX Protocol conformance.

Founding-contributor status does not grant independent protocol authority.

---

## Protocol Authority

Normative protocol behavior is governed collectively by:

- [`protocol/spec.md`](./protocol/spec.md);
- [`protocol/schemas/`](./protocol/schemas/);
- [`test-vectors/`](./test-vectors/);
- identifiers defined in [`protocol/error-codes.json`](./protocol/error-codes.json).

[`protocol/suites.json`](./protocol/suites.json) identifies required conformance suites.

Maintainers MUST apply these sources when reviewing protocol-visible behavior.

Maintainer interpretation does not create normative protocol behavior.

Implementation behavior does not create normative protocol behavior.

A conflict among normative sources requires protocol governance review.

Dependent protocol changes MUST NOT proceed until the conflict is resolved.

---

## Maintainer Roles

Repository maintenance uses the following roles.

### Protocol Steward

The protocol steward is responsible for:

- protocol governance;
- normative protocol releases;
- canonical conformance materials;
- protocol version decisions;
- stewardship transitions;
- protocol-critical merge authority.

ALX Foundation holds the protocol steward role.

### Protocol Maintainer

A protocol maintainer reviews changes affecting:

- `protocol/spec.md`;
- `protocol/schemas/`;
- `test-vectors/`;
- `protocol/error-codes.json`;
- `protocol/suites.json`;
- core protocol invariants;
- protocol-defined extensions.

Protocol maintainers MUST apply the process defined in [`GOVERNANCE.md`](./GOVERNANCE.md).

Protocol maintainers MUST NOT approve protocol-critical changes that bypass required review, conformance, or versioning requirements.

### Implementation Maintainer

An implementation maintainer reviews and maintains:

- SDKs;
- reference implementations;
- CLI components;
- conformance tooling;
- storage adapters;
- repository-maintained contracts;
- implementation tests.

Implementation maintainers MUST preserve conformance with normative protocol sources.

Implementation maintainers MUST NOT modify protocol requirements through implementation behavior.

### Documentation Maintainer

A documentation maintainer reviews:

- explanatory documentation;
- integration guides;
- examples;
- publication materials;
- terminology;
- cross-document references.

Documentation maintainers MUST preserve the distinction between normative and non-normative material.

Documentation maintainers MUST NOT introduce protocol requirements through explanatory documentation.

### Release Maintainer

A release maintainer performs repository release operations.

Release maintainers are responsible for:

- release preparation;
- version verification;
- required CI verification;
- conformance verification;
- changelog verification;
- release metadata;
- publication artifacts;
- release records.

Release authority does not grant authority to change protocol behavior.

### Security Maintainer

A security maintainer handles vulnerability reports under [`SECURITY.md`](./SECURITY.md).

Security maintainers are responsible for:

- private vulnerability intake;
- severity assessment;
- remediation coordination;
- disclosure coordination;
- security advisory preparation;
- security release coordination.

Security maintainers MUST preserve confidentiality before coordinated disclosure.

A security fix that changes protocol-visible behavior MUST follow the applicable protocol governance process.

---

## Repository Authority

Repository permissions authorize repository operations.

Repository permissions do not authorize changes to protocol behavior outside the governance process.

Maintainer permissions MAY include:

- issue management;
- pull request review;
- pull request approval;
- merge operations;
- branch management;
- release operations;
- repository configuration;
- security advisory management.

Permissions MUST be limited to responsibilities assigned to the maintainer.

A maintainer MUST NOT use repository permissions to bypass:

- required review;
- required conformance;
- required versioning;
- required security handling;
- protocol governance.

---

## Review Requirements

Maintainers MUST review changes within their assigned scope.

A review MUST evaluate applicable:

- change classification;
- repository scope;
- normative protocol sources;
- protocol invariants;
- conformance impact;
- API impact;
- test coverage;
- security impact;
- documentation impact;
- version impact.

Protocol-visible changes MUST identify affected normative sources.

Protocol-critical changes MUST identify affected invariants and canonical conformance materials.

Review approval MUST NOT be granted while required verification is failing.

Review approval MUST NOT be granted while a normative-source conflict remains unresolved.

---

## Change Classification

Maintainers MUST verify the declared classification of each change.

| Classification | Definition |
|---|---|
| **Breaking** | Changes existing protocol-visible behavior or guarantees |
| **Additive** | Introduces behavior while preserving existing protocol-visible behavior and guarantees |
| **Refactor** | Changes implementation, tooling, or documentation without changing protocol-visible behavior or guarantees |

A maintainer MUST require reclassification when the declared classification does not match the change.

Breaking changes MUST follow applicable protocol governance and versioning requirements.

Additive changes MUST preserve existing protocol-visible behavior, guarantees, and canonical core test-vector outputs.

Refactors MUST preserve protocol-visible behavior, guarantees, and canonical core test-vector outputs.

---

## Protocol-Critical Review

A change is protocol-critical when it modifies:

- canonicalization;
- hash derivation;
- Block identity;
- required Block structure;
- `parentHashes` normalization;
- Graph validity;
- lineage behavior;
- Trace computation;
- canonical core test vectors;
- another core protocol guarantee.

Before approving a protocol-critical change, maintainers MUST verify:

1. a public proposal exists;
2. the change classification is correct;
3. affected invariants are identified;
4. affected normative sources are identified;
5. affected normative sources are updated;
6. required canonical test vectors are updated or added;
7. required cross-implementation conformance passes;
8. the required public review period is complete;
9. version impact is resolved.

Protocol-critical changes MUST follow [`GOVERNANCE.md`](./GOVERNANCE.md).

Maintainers MUST NOT change canonical expected output to accommodate implementation-specific behavior.

---

## Conformance Responsibilities

Maintainers MUST preserve conformance between normative protocol sources, canonical conformance materials, and maintained implementations.

Protocol-visible changes MUST pass applicable required conformance suites.

Cross-implementation verification MUST include the applicable TypeScript, Rust, and Python implementations for protocol-critical changes.

An implementation disagreement with a canonical vector requires review of:

1. the applicable requirement in `protocol/spec.md`;
2. the applicable schema;
3. the canonical test vector;
4. the implementation behavior.

When the normative sources and canonical vector specify the same behavior, the implementation MUST conform to that behavior.

When normative sources conflict, maintainers MUST stop dependent protocol changes and initiate protocol governance review.

---

## Merge Requirements

A maintainer MAY merge a change when all applicable requirements are complete.

Before merge, the maintainer MUST verify:

- required reviews are complete;
- required CI passes;
- applicable tests pass;
- applicable conformance suites pass;
- required documentation is updated;
- required test vectors are updated;
- change classification is correct;
- version impact is resolved;
- unresolved normative-source conflicts do not exist;
- required governance review is complete.

A maintainer MUST NOT merge a change when a required gate is failing.

A maintainer MUST NOT bypass branch protection or required checks to merge an incomplete change.

Emergency security handling follows [`SECURITY.md`](./SECURITY.md).

Protocol-visible emergency fixes remain subject to applicable protocol governance requirements.

---

## Release Responsibilities

A protocol release MUST include verification of:

- protocol version;
- affected normative sources;
- canonical conformance materials;
- required conformance suites;
- maintained reference implementations;
- changelog entries;
- release metadata;
- publication status.

A release maintainer MUST confirm that required CI and conformance checks pass before release.

A release MUST NOT represent generated PDF or DOCX derivatives as canonical protocol sources.

Publication identity and derivative requirements are defined in [`PUBLICATION.md`](./PUBLICATION.md).

Version requirements are defined in [`docs/governance/versioning.md`](./docs/governance/versioning.md).

---

## Security Responsibilities

Maintainers MUST follow [`SECURITY.md`](./SECURITY.md) for vulnerability reporting, remediation, and disclosure.

Maintainers MUST NOT disclose unpatched vulnerability details through:

- public issues;
- public pull requests;
- public discussions;
- release notes;
- documentation.

Security-sensitive changes require review appropriate to the affected component.

Applicable areas include:

- canonicalization;
- hash derivation;
- Block validation;
- Graph validation;
- signing;
- replay protection;
- Merkle verification;
- contract behavior;
- input limits;
- resource limits.

A security remediation that changes protocol-visible behavior MUST follow protocol governance requirements.

---

## Documentation Responsibilities

Maintainers reviewing documentation MUST verify:

- canonical terminology;
- protocol claims against normative sources;
- normative and explanatory material are distinguished;
- examples use valid protocol structures;
- illustrative values are identified;
- application behavior is not represented as protocol behavior;
- external trust claims are not represented as protocol guarantees.

Documentation MUST NOT state that core ALX Protocol establishes:

- semantic truth;
- factual accuracy;
- authorship;
- originality;
- ownership;
- legal status;
- policy compliance;
- economic value;
- reward eligibility.

Documentation MUST NOT state that core Block validity requires:

- a hosted service;
- a registry;
- blockchain anchoring;
- a token;
- an economic mechanism;
- an ALX Labs product or service.

---

## Conflict of Interest

Maintainers MUST disclose a material conflict of interest affecting a protocol governance decision.

A material conflict includes a direct financial, organizational, contractual, or operational interest that can affect impartial review of the specific decision.

A maintainer with a material conflict MUST NOT act as the sole approver for the affected protocol-critical change.

When recusal is required, another authorized maintainer or the protocol steward MUST perform the required review.

Employment by, contribution to, or affiliation with ALX Foundation or ALX Labs does not independently require recusal.

The relevant conflict is the maintainer's interest in the specific decision.

---

## Maintainer Conduct

Maintainers MUST:

- apply repository policies consistently;
- document protocol-critical decisions;
- preserve public governance records;
- protect confidential security information;
- preserve unrelated contributor work;
- identify unresolved risks;
- use repository authority within assigned scope.

Maintainers MUST NOT:

- bypass protocol governance;
- suppress required conformance failures;
- alter canonical vectors to accommodate an implementation;
- represent application policy as protocol policy;
- use maintainer status to claim protocol conformance for an implementation;
- use founding-contributor status as independent protocol authority.

Maintainer conduct is also subject to [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

## Maintainer Appointment

Maintainers are appointed based on demonstrated responsibility within the applicable repository area.

Appointment requires:

- documented scope;
- assigned role;
- required repository permissions;
- acceptance of repository governance and security requirements.

Maintainer appointments MUST be recorded in a public repository record unless security responsibilities require restricted identity or access information.

Repository permissions MUST correspond to assigned responsibilities.

---

## Maintainer Removal

Maintainer status MAY be removed for:

- inactivity;
- resignation;
- repeated failure to follow repository policy;
- misuse of repository permissions;
- security-policy violations;
- undisclosed material conflicts affecting repository decisions;
- conduct violations;
- stewardship transition.

Removal of repository permissions does not modify protocol behavior or conformance status.

Maintainer removal decisions MUST be documented by the applicable repository or governance authority.

Sensitive security or personnel information MUST NOT be included in public records.

---

## Stewardship Transition

Maintainer roles are subject to the stewardship transition process defined in [`GOVERNANCE.md`](./GOVERNANCE.md).

A stewardship transition MAY change:

- merge authority;
- protocol maintainer appointment;
- release authority;
- governance review authority;
- repository administration.

A stewardship transition MUST preserve:

- public access to normative protocol sources;
- public access to canonical conformance materials;
- existing open-source licensing commitments;
- independent implementation rights.

Founding-contributor status does not grant permanent protocol authority.

---

## Operational Administration

ALX Labs MAY administer repository infrastructure, implementation infrastructure, security intake, release tooling, and supporting services under authority assigned by ALX Foundation.

Operational administration does not modify normative protocol authority.

ALX Labs products and services do not determine protocol conformance.

Repository infrastructure MUST NOT be represented as a requirement for independent ALX Protocol implementation.

---

## Maintainer Records

The repository SHOULD maintain records identifying active maintainers and assigned responsibilities.

Maintainer records SHOULD identify applicable:

- role;
- repository scope;
- review authority;
- merge authority;
- release authority;
- security responsibility.

Credentials, private contact information, security access details, and authentication material MUST NOT be included in public maintainer records.

---

## Related Documents

- [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship, change governance, and conformance
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution and review requirements
- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting and disclosure
- [`AGENTS.md`](./AGENTS.md) — repository instructions for AI-assisted contributors
- [`PUBLICATION.md`](./PUBLICATION.md) — publication identity and lifecycle
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — community conduct requirements
- [`protocol/spec.md`](./protocol/spec.md) — normative protocol specification
- [`protocol/schemas/`](./protocol/schemas/) — normative schemas
- [`test-vectors/`](./test-vectors/) — canonical test vectors
- [`protocol/error-codes.json`](./protocol/error-codes.json) — canonical error identifiers
- [`protocol/suites.json`](./protocol/suites.json) — conformance suite manifest
- [`docs/governance/protocol-change-process.md`](./docs/governance/protocol-change-process.md) — RFC process
- [`docs/governance/versioning.md`](./docs/governance/versioning.md) — versioning policy
