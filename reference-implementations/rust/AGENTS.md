# Rust Reference Implementation Guide

The root and parent reference-implementation guides remain applicable. This guide governs the Rust crate in this directory.

## Local rules

- Preserve the committed `Cargo.lock` for reproducible reference binaries.
- Use the crate's Keccak-256 implementation, not SHA3-256.
- Configure JSON parsing/number handling so accepted and rejected values match ALX boundaries exactly.
- Preserve duplicate raw object member detection before conversion to `serde_json::Value` where required by raw ingress.
- Implement UTF-16 code-unit key ordering explicitly; Rust string/byte ordering is not a substitute.
- Use `num-bigint` or equivalent arbitrary precision for Trace path counts and canonical decimal serialization.
- Avoid panics on untrusted input; return layer-appropriate errors and canonical identifiers.
- Keep public library behavior and both binaries aligned.

## Verification

From the repository root:

```bash
cargo fmt --manifest-path reference-implementations/rust/Cargo.toml -- --check
cargo clippy --manifest-path reference-implementations/rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path reference-implementations/rust/Cargo.toml --all-targets
pnpm run build:conformance:rust
pnpm run test:conformance:rust
```

Run `pnpm run verify:cross-language` for protocol-visible changes and applicable extension runners for signing/Merkle work.

## Stop and report

Stop if serde or a dependency cannot preserve canonical semantics, a panic path remains on untrusted input, or lockfile changes are unexplained. Report Rust/API compatibility, native tests, clippy/format, portable conformance, skips, and dependency impact.
