# Contributing

This document defines contribution requirements for ALX Protocol. This document does not define protocol behavior.

---

## Purpose

This document defines:

* repository contribution scope;
* change classification;
* protocol-critical change requirements;
* implementation requirements;
* documentation requirements;
* verification requirements;
* pull request requirements;
* security reporting procedures.

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

Contributions MUST conform to these sources.

A contribution MUST NOT introduce protocol behavior through implementation code, documentation, examples, tooling, or optional extensions when that behavior conflicts with normative protocol sources.

A conflict among normative sources requires protocol governance review.

Dependent changes MUST NOT proceed until the conflict is resolved.

---

## Repository Setup

Install dependencies:

```bash
pnpm install
```

Run the repository CI gate:

```bash
pnpm run ci
```

`pnpm run ci` runs the TypeScript CI gate, repository verification, CLI and adapter tests, unit tests, core conformance, and extension conformance.

Use individual commands during development:

```bash
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run schema:check
pnpm run verify
pnpm test
pnpm run test:conformance
pnpm run test:integration
pnpm run test:security
pnpm run test:fuzz
pnpm run test:extension
node cli/bin/alx.js test-vectors run
```

Repository scripts defined in the root `package.json` are authoritative for available commands.

---

## Repository Scope

Contributions may modify repository areas required by the change.

| Path                         | Scope                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| `protocol/`                  | Specification, schemas, suite manifest, and protocol extensions |
| `test-vectors/`              | Canonical language-neutral protocol vectors                   |
| `tests/`                     | Executable JavaScript tests organized by test responsibility  |
| `sdk/`                       | TypeScript SDK                                                |
| `reference-implementations/` | Reference implementations                                     |
| `conformance/`               | Conformance runners and verification                          |
| `cli/`                       | CLI, server, storage, and adapters                            |
| `contracts/`                 | Optional anchoring contracts                                  |
| `docs/`                      | Explanatory and integration documentation                     |
| `scripts/`                   | Repository tooling                                            |
| `.github/`                   | CI and repository automation                                  |

Changes MUST use the scope required to implement and verify the requested behavior.

Unrelated changes MUST NOT be included in the same pull request.

Product-specific behavior MUST NOT be introduced as core protocol behavior.

---

## Change Classification

Every pull request MUST declare one classification.

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

A protocol-critical contribution MUST include:

1. identification of affected normative sources;
2. identification of affected protocol invariants;
3. an impact classification;
4. updates to affected normative sources;
5. updated or additional canonical test vectors;
6. tests for changed behavior;
7. cross-implementation conformance results;
8. the version change required by repository policy.

Protocol-critical changes MUST follow [`GOVERNANCE.md`](./GOVERNANCE.md).

---

## Canonical Test Vectors

Canonical test vectors define conformance inputs and expected outputs for the behavior they cover.

A contribution that changes an existing canonical core test-vector output is a breaking change.

A correction to an existing canonical vector MUST identify the normative requirement that requires the correction.

A canonical vector correction MUST include:

* the affected normative source;
* the reason for the correction;
* updated expected output;
* cross-implementation verification.

Implementation-specific output MUST NOT replace canonical expected output without protocol governance review.

---

## Protocol Invariants

Contributions MUST preserve the following invariants unless an approved breaking protocol change modifies them:

* `Block` is the protocol primitive.
* `contentHash` identifies canonicalized Block content.
* `blockHash` identifies canonicalized Block content and normalized `parentHashes`.
* `parentHashes` declares direct parent Block identities.
* `Graph` represents connected Block structure.
* `Trace` represents structural attribution over Graph topology.
* `pathCount` represents the number of paths defined by the Trace rules.
* Block `content` remains opaque to core protocol verification.
* Core Block creation and verification do not require a hosted service.
* Core Block validity does not require blockchain anchoring.
* Optional extensions do not redefine core Block validity.

Structural attribution does not establish:

* authorship;
* originality;
* ownership;
* semantic importance;
* economic value;
* reward eligibility.

---

## Implementation Requirements

Implementation changes MUST:

* preserve applicable public API behavior unless the change authorizes an API change;
* include tests for changed behavior;
* use canonical protocol terminology;
* preserve deterministic behavior;
* follow layer-specific error conventions;
* document non-obvious contracts and security assumptions.

Protocol behavior MUST be defined by normative protocol sources and validated through applicable conformance materials.

Implementation code MUST NOT define independent protocol rules.

---

## Reference Implementations

ALX Protocol maintains reference implementations in TypeScript, Rust, and Python.

A protocol-visible change MUST be verified against the applicable reference implementations.

Reference implementation behavior does not define protocol behavior.

Implementation divergence MUST be reviewed against:

1. `protocol/spec.md`;
2. applicable schemas;
3. canonical test vectors;
4. applicable error identifiers.

A conflict among normative sources requires protocol governance review.

---

## Optional Extensions

Optional extensions operate outside core Block validity unless a protocol revision changes that boundary.

An extension contribution MUST:

* identify the extension scope;
* identify applicable normative sources;
* preserve core Block validity;
* include extension-specific tests;
* include conformance materials when the extension defines interoperable behavior;
* document dependencies and security assumptions.

Changes to signing, Merkle proofs, Content Envelope behavior, or anchoring MUST NOT modify core Block identity unless processed as a breaking protocol change.

---

## Documentation

Documentation MUST:

* use canonical protocol terminology;
* distinguish normative requirements from explanatory material;
* link protocol behavioral claims to canonical sources;
* preserve the protocol verification boundary;
* identify illustrative values as illustrative;
* use runnable public examples where execution is required.

Documentation MUST NOT:

* introduce normative protocol behavior;
* represent application conventions as protocol requirements;
* state that ALX verifies semantic truth, authorship, quality, ownership, legal status, or economic value;
* state that a blockchain, hosted service, registry, token, or commercial product is required for core protocol validity.

Generated PDF and DOCX files are non-canonical publication derivatives.

---

## Examples

Public examples MUST:

* use valid protocol structures;
* use canonical field names;
* distinguish illustrative values from canonical test-vector outputs;
* exclude credentials, secrets, private keys, tokens, and private data.

Runnable examples MUST execute against the documented repository version.

Application-level fields inside Block `content` MUST NOT be presented as required protocol fields.

---

## Verification

Run verification applicable to the modified area.

### Build

```bash
pnpm run build
```

### Repository Verification

```bash
pnpm run verify
```

### Unit Tests

```bash
pnpm test
```

### Integration Tests

```bash
pnpm run test:integration
```

### Security and Fuzz Tests

```bash
pnpm run test:security
pnpm run test:fuzz
```

### Core Conformance

```bash
pnpm run test:conformance
```

### Extension Conformance

```bash
pnpm run test:extension
```

### CLI Test Vectors

```bash
node cli/bin/alx.js test-vectors run
```

### Full CI

```bash
pnpm run ci
```

Protocol-visible changes MUST pass applicable cross-implementation conformance.

A pull request that does not run an applicable verification command MUST state:

* the command not run;
* the reason the command was not run;
* the resulting verification gap.

---

## Pull Requests

Every pull request MUST:

* define its scope;
* declare its change classification;
* identify affected files;
* identify affected protocol invariants when applicable;
* identify affected normative sources when applicable;
* include tests for changed behavior;
* include required test-vector changes;
* report verification commands executed;
* report verification commands not executed and the reason;
* identify protocol-visible behavior changes;
* identify remaining risks.

Protocol-critical pull requests MUST follow [`GOVERNANCE.md`](./GOVERNANCE.md).

Pull requests MUST NOT combine unrelated changes.

Commit messages MUST identify the affected area and resulting change.

Do not use commit messages such as:

* `fix`;
* `updates`;
* `changes`.

---

## Worktree Safety

Existing repository changes are user-owned.

Contributions MUST preserve unrelated changes.

The following operations require explicit authorization:

```text
git reset --hard
git checkout --
git restore <broad scope>
git push --force
```

Repository history MUST NOT be rewritten without explicit authorization.

Untracked or generated files MUST NOT be deleted unless the change requires their removal.

---

## Security

Do not commit:

* credentials;
* secrets;
* private keys;
* access tokens;
* private data.

Do not place secrets in:

* Block `content`;
* examples;
* fixtures;
* test vectors;
* logs;
* documentation.

Security vulnerabilities MUST be reported through the process defined in [`SECURITY.md`](./SECURITY.md).

Operational security intake is administered by ALX Labs.

Security reports MUST NOT be submitted through a public issue when disclosure would expose an unpatched vulnerability.

---

## Completion Requirements

A completed contribution MUST report:

* files changed;
* change classification;
* governing normative sources used;
* tests and verification commands executed;
* commands not executed and the reason;
* protocol-visible behavior changes;
* remaining risks or follow-up work.

A contribution is not complete when required verification fails.

A contribution with an unresolved normative-source conflict requires protocol governance review.

---

## Related Documents

* [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship, change governance, and conformance
* [`SECURITY.md`](./SECURITY.md) — vulnerability reporting
* [`MAINTAINERS.md`](./MAINTAINERS.md) — maintainer responsibilities
* [`AGENTS.md`](./AGENTS.md) — repository instructions for AI-assisted contributors
* [`protocol/spec.md`](./protocol/spec.md) — normative protocol specification
* [`protocol/schemas/`](./protocol/schemas/) — normative schemas
* [`test-vectors/`](./test-vectors/) — canonical test vectors
* [`protocol/error-codes.json`](./protocol/error-codes.json) — canonical error identifiers
* [`protocol/suites.json`](./protocol/suites.json) — conformance suite manifest
* [`docs/governance/protocol-change-process.md`](./docs/governance/protocol-change-process.md) — RFC process
* [`docs/governance/versioning.md`](./docs/governance/versioning.md) — versioning policy
