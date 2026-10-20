# Reference Implementations Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs `reference-implementations/`; language-specific nested guides add local commands.

## Role and authority

Python and Rust provide independent interoperability evidence. Neither implementation defines protocol behavior and neither should port TypeScript behavior without checking canonical sources.

## Cross-language invariants

- Match exact canonical bytes, Unicode/key ordering, number rendering, rejection, depth, and raw-ingress behavior.
- Use domain-separated Keccak-256 and preserve typed hash distinctions.
- Create/validate the five-field v1 Block and strict parent normalization.
- Implement canonical Graph request/result semantics, reachable-only source lookup, all four statuses, precedence, deterministic counts/order, and resource limits.
- Compute Trace path counts with arbitrary precision and serialize decimal text exactly.
- Emit canonical error identifiers where required; do not compare localized messages as protocol output.
- Keep optional signing/Merkle claims separate from core and match exact extension encodings/vectors.
- Keep replay, receipts, CLI ergonomics, and other language helpers classified as implementation/application APIs.
- Core behavior remains offline and independent of ALX Labs services.

## Change coupling

- A core behavioral change updates TypeScript, Python, Rust, canonical vectors, and differential coverage together.
- Add native tests for language-specific values and parser behavior that portable JSON cannot express.
- Do not normalize away duplicate source candidates or unsupported values before they can be diagnosed.
- Update parity/readme claims only after executable evidence passes.

## Repository verification

From the root:

```bash
pnpm run test:conformance:python
pnpm run build:conformance:rust
pnpm run test:conformance:rust
pnpm run verify:cross-language
pnpm run lint:python
pnpm run lint:rust
```

Also run each language's native tests from its nested guide. Run applicable extension adapters when extension implementation changes.

## Stop conditions

Stop if canonical sources conflict, a language cannot represent a required result exactly, a native limitation would be hidden as a pass, a dependency changes cryptographic semantics, or parity documentation would overstate tested support.

## Completion evidence

Report languages and operations affected, portable/native cases, skips, differential result, dependency/toolchain impact, parity claims changed, and protocol-visible impact.
