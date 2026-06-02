# Security Policy

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

## Non-goals

This document does not cover:

- Complete threat model and trust boundaries — see [`docs/governance/security.md`](docs/governance/security.md)
- Verification scope summary — see [`docs/trust-model.md`](docs/trust-model.md)
- Stewardship policy — see [`GOVERNANCE.md`](GOVERNANCE.md)

---

## Reporting a Vulnerability
If you discover a security vulnerability in ALX Protocol, please report it responsibly.

**Email:** security@xandrlabs.ai

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
- Smart contract vulnerabilities in **ALXAnchor** on Base (and optional read-only CID pointer reads when using `alx block resolve --chain base`)
- Denial of service via deeply nested or adversarial input
- Cross-implementation divergence (two conformant implementations producing different output)

### Out of Scope

- Vulnerabilities in third-party dependencies (report to the dependency maintainer)
- Social engineering attacks
- Attacks requiring physical access to the server
- Content-level vulnerabilities (the protocol does not inspect content)

## Threat Model

The complete threat model, trust boundaries, and cryptographic assumptions are in [`docs/governance/security.md`](docs/governance/security.md).

## Known Issues

None at this time. Known issues will be listed here with severity, affected versions, and workarounds.

## Supported Versions

| Version | Supported |
|---|---|
| Protocol v1 (current) | Yes |

## Disclosure Policy

We follow coordinated disclosure:

1. Reporter submits vulnerability via security@xandrlabs.ai
2. We acknowledge and assess severity
3. We develop and test a fix
4. We release the fix and notify the reporter
5. We publicly disclose the vulnerability (credited unless the reporter prefers anonymity)

We will credit reporters in the CHANGELOG unless they prefer anonymity.

---

## Related Documents

- [`docs/governance/security.md`](docs/governance/security.md) — complete threat model and trust boundaries
- [`docs/trust-model.md`](docs/trust-model.md) — verification scope summary
- [`GOVERNANCE.md`](GOVERNANCE.md) — project stewardship
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution process
