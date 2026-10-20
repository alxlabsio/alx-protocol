# CLI and Local Services Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs `cli/`.

## Role and boundary

The CLI, HTTP server, retrieval server, project store, and Graph-query commands are application shells around maintained SDK behavior. Command success, storage presence, retrieval, indexing, and anchoring do not independently establish protocol conformance or validity.

## Local invariants

- Delegate canonicalization, identity, Block validation, Graph verification, and Trace to the SDK.
- Parse untrusted JSON strictly and apply bounded input/output handling.
- Keep human output and stable JSON output distinct; avoid ANSI codes in machine output.
- Use canonical error identifiers where protocol-visible and separate operational exit/errors.
- Parent/ancestor queries follow declared `parentHashes`; child/descendant queries are limited to the selected observed source.
- Query envelopes report source scope, revision, pagination, and truncation separately from protocol Trace completeness.
- `block show` and listings do not imply revalidation unless documented and performed.
- Retrieved Blocks must be validated before being represented as verified.
- Keep paths confined to explicit project/data roots and protect atomic writes, temporary files, and cleanup.
- Network, IPFS, RPC, contract, API-key, and server behavior remains optional and outside core validity.
- Never log API keys, private keys, full sensitive content, or authorization headers.

## Command changes

- Update command registry, argument parsing, help output, package README, OpenAPI/server routes, and integration tests together.
- Preserve exit codes and JSON shapes unless a breaking CLI change is authorized.
- Do not add aliases that make application queries look like new protocol operations.
- Default tests must not require live networks, deployed contracts, or credentials.

## Verification

From the repository root:

```bash
pnpm run test:cli
pnpm --filter @alx-protocol/cli test
pnpm run test:security
pnpm run format:check
node cli/bin/alx.js --help
```

Run `pnpm run test:integration` for cross-package changes, `pnpm run test:contracts` for anchoring behavior, and `pnpm run verify:protocol` only when canonical sources change.

## Stop conditions

Stop if a command would invent protocol behavior, a destructive storage migration lacks authorization/recovery, path containment is unclear, machine output would break without approval, or verification requires real credentials or deployment authority.

## Completion evidence

Report commands/routes changed, human/JSON/exit-code impact, storage or migration impact, security boundaries tested, networks intentionally omitted, and protocol-visible impact.
