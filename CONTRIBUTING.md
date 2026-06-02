# Contributing

This document describes how to contribute to ALX Protocol. This document does not define protocol behavior.

---

## Purpose

This document tells contributors what may change in the repository, how to run verification before opening a pull request, and how to classify impact (breaking, additive, refactor).

## Scope

This document covers:

- Repository areas open to contribution
- Protocol-critical change rules and test vector requirements
- Design principles for pull requests
- Security reporting pointer

## Non-goals

This document does not cover:

- Stewardship tiers and conformance governance — see [`GOVERNANCE.md`](./GOVERNANCE.md)
- RFC process and maintainer roles — see [`docs/governance/governance.md`](./docs/governance/governance.md)
- Normative protocol behavior — see [`protocol/spec.md`](./protocol/spec.md)

---

## First Contribution

```bash
pnpm install
pnpm run ci
```

`pnpm run ci` runs the TypeScript CI gate: build, repo verification, artifact-package tests, unit tests, core conformance, and extension conformance (Merkle + signing).

Individual commands when iterating:

```bash
pnpm run build
pnpm run verify          # all repo verification gates
pnpm test
pnpm run test:conformance
pnpm run test:extension  # Merkle + signing extension self-tests
node cli/bin/alx.js test-vectors run
pnpm run maintainer:audit  # optional advisory scans (requires maintainer/ locally)
```

---

## Repository areas

Changes MUST be limited to protocol-critical components:

- `protocol/`
- `reference-implementations/`
- `cli/`
- `conformance/`
- `docs/`
- `artifact-packages/`
- `.github/workflows/`

---

## Change Rules

- Changes to canonical hashing, proof hashing, schemas, or invariants are **protocol-critical** and MUST be treated as **breaking** unless explicitly proven otherwise.

- Changes that alter existing test vector outputs MUST include:
  - a version impact assessment (e.g., breaking vs additive)
  - updated specification in `protocol/spec.md` when normative behavior changes
  - updated/expanded test vectors in `protocol/test-vectors/` and passing cross-implementation conformance

- New guarantees or behaviors MUST include:
  - corresponding documentation in `docs/`
  - associated tests and test vectors where behavior is protocol-visible

- The repository is **implementation-agnostic**:
  - protocol rules MUST be defined in specifications and conformance tests
  - product-specific logic MUST NOT be introduced into `protocol/`

---

## Design Principles

- **Deterministic Execution** — Canonical inputs produce identical outputs across conforming implementations
- **Verifiable Outputs** — Outputs can be independently validated against canonical inputs
- **Composable Artifacts** — Artifacts are reusable, extensible, and recombinable across systems
- **Attribution by Design** — Attribution is deterministically derived from lineage and enforced through protocol-level invariants

Code and architecture reviews use the internal codebase rubric in [`maintainer/rubrics/codebase-rubric.md`](./maintainer/rubrics/codebase-rubric.md) (gitignored; see [`maintainer/README.md`](./maintainer/README.md)). Comment placement and review: **Part 13** (CC-1 through CC-12); obvious-comment deletion: **Part 10** (LD-10).

---

## Pull Requests

- Changes MUST be tightly scoped.
- Changes MUST reference affected invariants and/or specification sections.
- `pnpm run ci` MUST pass prior to submission (or the equivalent individual commands when iterating).
- Each change MUST declare its impact:
  - **breaking** — alters behavior or existing guarantees
  - **additive** — introduces new behavior without affecting existing guarantees
  - **refactor** — no behavioral or guarantee changes

See [`GOVERNANCE.md`](./GOVERNANCE.md) for stewardship tiers and [`docs/governance/governance.md`](./docs/governance/governance.md) for the RFC process.

---

## Security

Report security concerns via: `security@xandrlabs.ai` (see [`SECURITY.md`](./SECURITY.md))

---

## Related Documents

- [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship and conformance as governance
- [`docs/governance/governance.md`](./docs/governance/governance.md) — RFC process and maintainer roles
- [`AGENTS.md`](./AGENTS.md) — invariants and terminology for AI-assisted contributors
- [`maintainer/docs/STYLE-GUIDE.md`](./maintainer/docs/STYLE-GUIDE.md) — documentation conventions
- [`protocol/spec.md`](./protocol/spec.md) — normative protocol behavior
