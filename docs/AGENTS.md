# ALX Documentation Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs every file under `docs/`.

## Scope and authority

`docs/` contains explanatory architecture, implementation, integration, security, governance, and decision material. It does not define ALX Protocol behavior.

Canonical behavior is governed collectively by:

1. [`../protocol/spec.md`](../protocol/spec.md);
2. [`../protocol/schemas/`](../protocol/schemas/);
3. [`../test-vectors/`](../test-vectors/); and
4. [`../protocol/error-codes.json`](../protocol/error-codes.json).

[`../protocol/suites.json`](../protocol/suites.json) is the conformance-suite discovery manifest. When explanatory text conflicts with canonical sources, repair the explanatory text. When canonical sources conflict, stop and report the conflict.

## Document responsibilities

- `README.md` is the documentation map, not a second specification.
- `architecture.md`, `trust-model.md`, and focused reference pages explain canonical boundaries.
- `decisions/` records durable design decisions and rationale; it must not become current normative authority.
- `governance/` explains public process, compatibility, migration, stability, and review status.
- `implementers/` supports independent implementations and conformance.
- `integrators/` supports applications using maintained public packages and optional integrations.
- Point-in-time audits, handoffs, private findings, product plans, and XNDR application architecture do not belong in the public protocol documentation set.

Every retained document must have a distinct audience and durable responsibility. Do not keep a document merely because it already exists, and do not create navigation stubs unless a stable public entry point justifies them.

## Local invariants

- Use canonical capitalization and field names: `Block`, `Graph`, `Trace`, `contentHash`, `blockHash`, `parentHashes`, `pathCount`, and `protocolVersion`.
- Describe `content` as an ALX value. Do not broaden it to arbitrary JSON-serializable or language-native values.
- Treat `parentHashes` as declared direct parents. Children, descendants, neighborhoods, indexed relationships, and observations are application/indexer concepts.
- Distinguish Block validation from Graph verification and preserve `valid`, `invalid`, `incomplete`, and `resource_limit_reached` meanings.
- Do not present `not_checked` as a Graph validation status.
- Do not imply that absence alone, storage presence, anchoring, signing, indexing, or service acceptance establishes protocol validity.
- Do not describe `pathCount` as authorship, ownership, quality, importance, reward, or settlement weight.
- Keep storage, discovery, databases, crawlers, indexers, Explorers, consensus, tokens, and application backends outside ALX Core.
- Keep signing, Merkle proofs, content profiles, contracts, and chain integrations explicitly optional.
- Distinguish protocol version, package version, extension version, and deployment version.
- Organizational and publication claims must agree with [`../PUBLICATION.md`](../PUBLICATION.md): ALX Foundation is protocol steward and ALX Labs is the founding contributor.

## Normative language and examples

- Use `MUST`, `SHOULD`, and `MAY` only when accurately summarizing a linked canonical requirement. Prefer descriptive language for guidance.
- Link behavioral claims to the governing source instead of reproducing long normative passages.
- Runnable examples must use maintained public exports and execute against the documented repository version.
- Mark hashes and outputs as illustrative unless copied from an identified canonical vector.
- Application fields such as `type`, `model`, `repository`, and `metadata` must be labeled as application conventions.
- Never include credentials, private keys, access tokens, private findings, or personal data.

## Change rules

- Make the smallest high-confidence repair. Do not alter protocol sources, code, tests, fixtures, or vectors merely to make documentation agree.
- Check inbound links before moving or deleting a document. Migrate unique content and update every repository reference first.
- Keep root and directory READMEs navigation-focused.
- Preserve historical ADR context while marking superseded assumptions and linking to the current authority.
- Do not publish point-in-time local paths, working-tree snapshots, active security TODOs, or maintainer handoffs.
- Generated PDF, DOCX, and site output are non-canonical; edit their reviewed source instead.

## Verification

Run from the repository root:

```bash
pnpm run format:check
npx --yes markdown-link-check@3.13.7 --config .markdown-link-check.json <changed-markdown-files>
pnpm run protocol:site:check
```

Also run the documented example or affected package test when runnable code changes. Run `pnpm run verify:protocol` only when the documentation change accompanies protocol-visible source changes.

## Stop conditions

Stop and request direction if:

- canonical sources conflict or do not support a behavioral claim;
- a move would break a published stable URL without a redirect decision;
- useful content cannot be assigned a clear public or internal owner;
- an example requires unavailable private infrastructure, credentials, or unpublished packages;
- a repair would require changing protocol behavior, conformance expectations, or security controls;
- deletion would discard unique governance, security, migration, or compatibility history.

## Completion evidence

In addition to the root completion report, list documents added, repaired, consolidated, moved, or removed; identify authority and audience changes; report link and example checks; and state whether any public path or protocol-visible claim changed.
