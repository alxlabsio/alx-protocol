# Security Policy

This document defines security reporting and disclosure requirements for ALX Protocol. This document does not define protocol behavior.

---

## Purpose

This document defines:

* vulnerability reporting;
* report requirements;
* response targets;
* severity classification;
* security scope;
* disclosure procedures;
* supported protocol versions.

The protocol threat model is defined in [`docs/governance/protocol-security-model.md`](docs/governance/protocol-security-model.md).

Security review status and audit evidence are maintained in [`docs/governance/independent-security-review-plan.md`](docs/governance/independent-security-review-plan.md).

---

## Reporting a Vulnerability

Security vulnerabilities MUST be reported privately.

**Email:** `security@alxlabs.io`

ALX Labs administers operational security intake for ALX Protocol under ALX Foundation stewardship.

Do not submit an unpatched vulnerability through:

* public GitHub issues;
* public pull requests;
* GitHub Discussions;
* public communication channels.

A security report SHOULD include:

* affected component;
* affected version or commit;
* vulnerability description;
* reproduction steps;
* proof of concept when available;
* expected security impact;
* known prerequisites;
* suggested remediation when available.

Reports containing sensitive material SHOULD include only the information required to reproduce and assess the vulnerability.

---

## Response Targets

| Action                              | Target                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| Acknowledge report                  | Within 48 hours                                                      |
| Initial severity assessment         | Within 5 business days                                               |
| Critical or high remediation target | Within 14 days                                                       |
| Medium or low remediation target    | Within 30 days                                                       |
| Public disclosure                   | After remediation is released or disclosure is otherwise coordinated |

Response targets are operational targets. Investigation complexity, dependency coordination, protocol governance, or release requirements may affect remediation time.

The security maintainers SHOULD notify the reporter when a target changes.

---

## Severity Classification

### Critical

A Critical vulnerability permits compromise of a core protocol security property or widespread production integrity without an expected trust boundary.

Examples include:

* acceptance of an invalid `blockHash` as valid;
* acceptance of an invalid `contentHash` as valid;
* deterministic identity forgery caused by an implementation defect;
* verification bypass affecting core Block validity;
* canonicalization divergence that permits incompatible identities to be accepted as equivalent.

### High

A High vulnerability compromises a security-sensitive extension, verification mechanism, or protocol-dependent security control.

Examples include:

* signature verification bypass;
* replay protection bypass;
* Merkle proof forgery;
* authorization bypass in protocol tooling;
* exploitable Graph validation bypass;
* exploitable contract anchoring defect.

### Medium

A Medium vulnerability causes material availability, isolation, or information-exposure impact without directly compromising core Block identity.

Examples include:

* denial of service from adversarial protocol input;
* uncontrolled resource consumption;
* parser exhaustion;
* stack exhaustion;
* unintended disclosure of internal request or verification data.

### Low

A Low vulnerability has limited security impact and does not compromise core protocol validity.

Examples include:

* non-sensitive internal-state disclosure;
* limited diagnostic information exposure;
* security-relevant behavior requiring restrictive preconditions.

Severity is assigned from demonstrated impact, exploitability, affected scope, and required preconditions.

---

## Security Scope

Security review covers vulnerabilities in repository-maintained protocol and implementation components.

### Core Protocol Processing

In-scope concerns include:

* canonicalization divergence;
* incorrect canonical byte representation;
* `contentHash` derivation errors;
* `blockHash` derivation errors;
* hash verification bypasses;
* invalid `parentHashes` normalization;
* malformed Block acceptance;
* Graph validation bypasses;
* cycle-detection failures;
* Trace computation errors with security impact;
* cross-implementation behavior that violates normative protocol requirements.

### Cryptographic Processing

In-scope concerns include:

* incorrect Keccak-256 input construction;
* incorrect hash encoding or decoding;
* signature verification bypasses;
* signing-domain errors;
* replay protection failures;
* Merkle proof verification errors;
* cryptographic implementation errors in repository-maintained code.

Cryptographic hash functions and canonicalization are separate protocol operations.

Canonicalization produces the deterministic representation used as hash input.

Hash derivation applies the specified hash function to the required canonical representation.

### Protocol Extensions

Security concerns in repository-maintained extensions are in scope.

This includes applicable:

* signing;
* attestations;
* Merkle proofs;
* Content Envelope processing;
* anchoring integrations.

Extension vulnerabilities do not change core Block validity unless the vulnerability also affects core protocol processing.

### CLI, Server, and Storage

In-scope concerns include:

* unsafe handling of untrusted Block data;
* request validation bypass;
* unauthorized data access;
* unintended sensitive-data disclosure;
* injection vulnerabilities;
* path traversal;
* denial of service caused by repository-maintained processing;
* security failures in repository-maintained storage or retrieval logic.

### Contracts

Repository-maintained smart contracts are in scope.

Relevant concerns include:

* incorrect commitment verification;
* authorization failures;
* replay vulnerabilities;
* state-integrity failures;
* proof verification errors;
* contract behavior that conflicts with documented anchoring semantics.

Contract anchoring is outside core Block validity.

---

## Protocol Security Boundary

ALX Protocol verifies structural properties defined by the protocol.

Core verification includes applicable:

* Block structure;
* deterministic identity;
* content integrity;
* declared parent lineage;
* Graph structure;
* Trace computation.

Core protocol verification does not establish:

* factual accuracy;
* semantic truth;
* authorship;
* originality;
* ownership;
* signer identity outside defined cryptographic evidence;
* legal validity;
* policy compliance;
* content safety;
* economic value;
* storage availability.

A report concerning one of these external properties is a protocol security issue only when repository-maintained software incorrectly claims, enforces, or processes the property in a security-relevant manner.

The complete trust boundary is defined in [`docs/governance/protocol-security-model.md`](docs/governance/protocol-security-model.md).

---

## Adversarial Input

Repository-maintained implementations MUST treat externally supplied protocol data as untrusted input.

Security review SHOULD consider:

* deeply nested JSON;
* large content payloads;
* large parent sets within protocol limits;
* malformed hashes;
* duplicate parent references;
* invalid Unicode;
* canonicalization edge cases;
* cyclic Graph data;
* unresolved parent references;
* malformed extension data;
* repeated verification requests;
* resource-exhaustion inputs.

Implementations SHOULD enforce applicable protocol limits before performing resource-intensive processing.

Implementation-specific resource limits MUST NOT be represented as protocol requirements unless defined by normative protocol sources.

---

## Out of Scope

The following are outside repository security scope unless repository-maintained code introduces or materially contributes to the vulnerability:

* vulnerabilities exclusively in third-party dependencies;
* social engineering;
* physical-access attacks;
* user-controlled content semantics;
* factual errors in Block `content`;
* application-specific policy decisions;
* external storage-provider availability;
* external blockchain consensus failures;
* vulnerabilities in independently maintained implementations;
* vulnerabilities in independently maintained applications or services.

Third-party dependency vulnerabilities SHOULD be reported to the responsible dependency maintainer.

A dependency vulnerability that creates an exploitable condition in ALX-maintained code MAY also be reported to the ALX Protocol security channel.

---

## Protocol-Sensitive Areas

Changes to the following areas require security review appropriate to the change:

* canonicalization;
* hash derivation;
* Block validation;
* `parentHashes` normalization;
* Graph validation;
* Trace computation;
* signing;
* replay protection;
* Merkle proofs;
* contract anchoring.

A security fix that changes protocol-visible behavior MUST follow the applicable process in [`GOVERNANCE.md`](GOVERNANCE.md).

A security fix that changes canonical core test-vector output is a breaking protocol change unless the change corrects a vector that conflicts with the governing normative sources.

Canonical-vector corrections require protocol governance review.

---

## Sensitive Data

Repository content MUST NOT contain:

* credentials;
* private keys;
* access tokens;
* authentication secrets;
* private vulnerability details before coordinated disclosure;
* unintended private data.

Secrets MUST NOT be placed in:

* Block `content`;
* test vectors;
* fixtures;
* examples;
* logs;
* documentation;
* committed configuration.

Security reports MUST contain only sensitive information required for investigation.

---

## Security Review Status

ALX Protocol has not completed an independent security audit.

Repository tests, conformance suites, contract tests, dependency analysis, and automated analysis provide internal verification evidence. These activities do not constitute an independent security audit.

Current audit scope, review status, dependency findings, contract review status, evidence, and residual risks are maintained in:

[`docs/governance/independent-security-review-plan.md`](docs/governance/independent-security-review-plan.md)

Transient audit results MUST be recorded in the audit document or associated review records rather than this policy.

---

## Supported Versions

| Version     | Security support |
| ----------- | ---------------- |
| Protocol v1 | Supported        |

Security support for previous or future versions MUST be recorded in this table when support status changes.

---

## Vulnerability Handling

After receiving a report, security maintainers MUST:

1. acknowledge the report;
2. establish a private tracking record;
3. assess reproducibility;
4. determine affected components and versions;
5. assign severity;
6. identify applicable protocol and implementation boundaries;
7. develop and verify remediation;
8. complete required protocol governance when protocol-visible behavior changes;
9. prepare the applicable release;
10. coordinate disclosure with the reporter.

Remediation MUST include tests that reproduce the vulnerability when safe and practical.

Protocol-visible remediation MUST include applicable conformance coverage.

Sensitive vulnerability details MUST remain restricted until coordinated disclosure or another documented disclosure decision.

---

## Disclosure

ALX Protocol uses coordinated vulnerability disclosure.

Public disclosure SHOULD occur after:

* remediation is available;
* affected releases are published when required;
* the reporter has been notified;
* protocol governance requirements are complete when applicable.

A disclosure SHOULD identify:

* affected versions;
* affected components;
* security impact;
* remediation;
* fixed version or commit;
* required user action;
* reporter credit when authorized.

Reporter identity MUST NOT be published without consent.

Reporter credit SHOULD be included in the applicable security advisory or `CHANGELOG.md` when requested and authorized.

---

## Security Advisories

Confirmed vulnerabilities affecting released repository components SHOULD receive a public security record after coordinated disclosure.

The record SHOULD identify:

* affected versions;
* severity;
* impact;
* remediation;
* fixed versions;
* migration or update requirements.

Public security records MUST NOT disclose credentials, private keys, private user data, or unnecessary exploit material.

---

## Contract Deployment

Repository implementation of an anchoring contract does not establish deployment status.

Deployment status MUST be documented separately from implementation status.

A production contract deployment SHOULD have:

* completed applicable contract tests;
* completed documented security review requirements;
* recorded deployment parameters;
* recorded chain and contract address;
* recorded source version or commit;
* documented operational authority.

Contract deployment does not modify core ALX Protocol validity.

---

## Security Contact

Security reports:

`security@alxlabs.io`

Operational security intake is administered by ALX Labs under ALX Foundation protocol stewardship.

General contribution questions and non-sensitive defects SHOULD use the repository contribution channels.

---

## Related Documents

* [`GOVERNANCE.md`](GOVERNANCE.md) — protocol governance and change classification
* [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and verification requirements
* [`docs/governance/protocol-security-model.md`](docs/governance/protocol-security-model.md) — threat model and trust boundaries
* [`docs/governance/independent-security-review-plan.md`](docs/governance/independent-security-review-plan.md) — audit scope, evidence, and review status
* [`docs/threat-model.md`](docs/threat-model.md) — public threat-model entry point
* [`docs/trust-model.md`](docs/trust-model.md) — protocol verification boundary
* [`protocol/spec.md`](protocol/spec.md) — normative protocol specification
* [`protocol/suites.json`](protocol/suites.json) — conformance suite manifest
