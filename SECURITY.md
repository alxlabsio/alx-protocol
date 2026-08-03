# Security Policy

**Status:** Repository security policy
**Audience:** Users, contributors, maintainers, and security researchers
**Authority:** Governs vulnerability reporting, response, and disclosure practices; canonical protocol sources govern protocol behavior
**Last reviewed:** 2026-08-03

This document describes vulnerability reporting and response for ALX Protocol. This document does not define protocol behavior.

---

## Purpose

This document tells security researchers how to report vulnerabilities, what response timelines to expect, and which components are in scope for coordinated disclosure.

## Scope

This document covers:

- Reporting channel and required report contents
- Response timelines and severity classification
- In-scope and out-of-scope vulnerability categories
- Disclosure policy and supported protocol versions

## Non-Goals

This document does not cover:

- Complete threat model and trust boundaries — see [`docs/governance/security.md`](docs/governance/security.md)
- Verification scope summary — see [`docs/trust-model.md`](docs/trust-model.md)
- Stewardship policy — see [`GOVERNANCE.md`](GOVERNANCE.md)

---

## Reporting a Vulnerability
If you discover a security vulnerability in ALX Protocol, please report it responsibly.

**Email:** security@xandrlabs.ai

Xandr Labs administers this operational security intake for ALX Protocol under ALX Foundation stewardship. Use of this address does not give Xandr Labs products or services authority over protocol conformance.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

| Action | Target |
|--------|--------|
| Acknowledgment of report | Within 48 hours |
| Severity assessment | Within 5 business days |
| Fix for critical/high severity | Within 14 days |
| Fix for medium/low severity | Within 30 days |
| Public disclosure | After fix is released, coordinated with reporter |

## Severity Classification

| Severity | Description | Examples |
|----------|-------------|----------|
| **Critical** | Can produce incorrect hashes or bypass verification | Hash collision in canonicalization, blockHash forgery |
| **High** | Can compromise signing or on-chain anchoring | EIP-712 signature bypass, Merkle proof forgery |
| **Medium** | Can cause denial of service or resource exhaustion | Unbounded memory allocation, stack overflow |
| **Low** | Information disclosure or minor misbehavior | Error messages leaking internal state, timing side channels |

## Scope

Security concerns relevant to this project include:

- Hash collision attacks against keccak-256 canonicalization
- Canonicalization bypasses that produce different hashes for equivalent inputs
- EIP-712 signature verification vulnerabilities
- Replay attacks against signed protocol requests
- Smart contract vulnerabilities in **ALXAnchor** on Base
- Denial of service via deeply nested or adversarial input
- Cross-implementation divergence (two conformant implementations producing different output)

### Out of Scope

- Vulnerabilities in third-party dependencies (report to the dependency maintainer)
- Social engineering attacks
- Attacks requiring physical access to the server
- Content-level vulnerabilities (the protocol does not inspect content)

## Threat Model

The complete threat model, trust boundaries, and cryptographic assumptions are in [`docs/governance/security.md`](docs/governance/security.md).

## Security Review Status

ALX Protocol has not completed an independent security audit. Repository conformance, native implementation tests, contract tests, and automated analysis provide internal evidence and do not replace independent review.

The production JavaScript dependency graph reports no known advisory for dependency commit `79ee792`. The private Hardhat 2 development graph retains transitive advisories that do not ship in published SDK or CLI runtime dependencies. The independent review scope, evidence requirements, residual risks, and publication record are maintained in [`docs/governance/security-audit.md`](docs/governance/security-audit.md).

`ALXAnchor` is implemented and not deployed. Mainnet deployment remains pending independent contract review.

## Known Issues

No confirmed protocol or runtime vulnerability is recorded at this time. Development-tool advisories and independent-review status are recorded separately in the audit readiness document.

## Supported Versions

| Version | Supported |
|---|---|
| Protocol v1 (current) | Yes |

## Disclosure Policy

We follow coordinated disclosure:

1. Reporter submits vulnerability via security@xandrlabs.ai
2. The operational security maintainers acknowledge and assess severity
3. Maintainers develop and test a fix under the repository governance process
4. Maintainers release the fix and notify the reporter
5. Maintainers publicly disclose the vulnerability (credited unless the reporter prefers anonymity)

We will credit reporters in the CHANGELOG unless they prefer anonymity.

---

## Related Documents

- [`docs/governance/security.md`](docs/governance/security.md) — complete threat model and trust boundaries
- [`docs/governance/security-audit.md`](docs/governance/security-audit.md) — independent review scope and publication record
- [`docs/trust-model.md`](docs/trust-model.md) — verification scope summary
- [`GOVERNANCE.md`](GOVERNANCE.md) — project stewardship
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution process
