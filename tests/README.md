# Executable Tests

This directory contains executable JavaScript tests. Canonical protocol inputs and expected outputs are data under [`../test-vectors/`](../test-vectors/), not executable test code.

| Directory | Responsibility | Public command |
|---|---|---|
| [`unit/`](unit/) | Deterministic SDK unit tests | `pnpm run test:unit` |
| [`conformance/`](conformance/) | Tests of manifest and runner infrastructure | `pnpm run test:conformance` |
| [`security/`](security/) | Deterministic malformed-input and security-boundary regression tests | `pnpm run test:security` |
| [`fuzz/`](fuzz/) | Seeded/property-based testing kept outside the default unit suite | `pnpm run test:fuzz` |
| [`integration/`](integration/) | CLI and adapter integration tests | `pnpm run test:integration` |

Python and Rust retain their language-native test directories under their reference implementations. Hardhat contract tests remain in `contracts/test/` for tool-native discovery. Optional extension vectors remain adjacent to their extension definitions.

`pnpm run test:coverage` enforces per-file coverage floors for the protocol-critical TypeScript modules. `pnpm run test:mutation` is the slower mutation-quality gate and remains outside the default developer loop.
