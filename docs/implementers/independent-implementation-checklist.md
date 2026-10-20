# Independent Implementation Checklist

**Document type:** Guide

Use this checklist for an ALX v1 implementation that does not depend on repository implementation code.

## Authority

- [ ] Read [`../../protocol/spec.md`](../../protocol/spec.md).
- [ ] Resolve structures through [`../../protocol/schemas/`](../../protocol/schemas/).
- [ ] Discover required suites only through [`../../protocol/suites.json`](../../protocol/suites.json).
- [ ] Consume canonical inputs and expected results from [`../../test-vectors/`](../../test-vectors/).
- [ ] Emit exact required identifiers from [`../../protocol/error-codes.json`](../../protocol/error-codes.json).

## Value and identity

- [ ] Define the ALX value boundary without accepting unsupported language-native values.
- [ ] Reject ambiguous raw JSON before value construction.
- [ ] Match exact canonical bytes, UTF-16 key ordering, number rendering, Unicode handling, and depth behavior.
- [ ] Use domain-separated Keccak-256, not SHA3-256.
- [ ] Keep content, Block, attestation, and Merkle hash domains distinct.
- [ ] Validate parent collections fail-closed, normalize deterministically, and enforce the parent limit.
- [ ] Create and validate the five-field v1 Block, including `protocolVersion: "1"`.

## Graph and Trace

- [ ] Keep Block validity separate from Graph verification.
- [ ] Implement `validateGraph(seed, source, context)` with the canonical request and complete result shapes.
- [ ] Preserve duplicate Block candidates until lookup can diagnose them.
- [ ] Inspect only reachable, in-scope candidates.
- [ ] Apply `invalid > resource_limit_reached > incomplete > valid` precedence.
- [ ] Treat absence alone as `incomplete`, never `invalid`.
- [ ] Support closed-world default and explicitly declared open-world boundaries.
- [ ] Preserve context, deterministic counts, sorted collections, issues, and limit information.
- [ ] Reject cycles and compute exact arbitrary-precision Trace `pathCount` strings.
- [ ] Do not reuse Trace completeness for pagination or index coverage.

## Conformance interface

- [ ] Implement every applicable required operation discovered from the manifest.
- [ ] Follow the newline-delimited JSON adapter contract in [`../../conformance/README.md`](../../conformance/README.md).
- [ ] Keep stdout protocol-clean and diagnostics on stderr.
- [ ] Bound child-process input, output, and execution.
- [ ] Report non-portable language-native cases as such.
- [ ] Add native tests for cases that JSON cannot transport.

Run the external adapter from the repository root:

```bash
node conformance/bin/run.js --impl "<your adapter command>"
```

Passing selected or historical cases is not a complete conformance claim. A complete claim covers every applicable required suite in the current manifest.

## Extension claims

- [ ] Keep core conformance independent of signing, Merkle, content profiles, contracts, storage, and networks.
- [ ] Claim an extension only after passing its separate manifest-selected or documented suite.
- [ ] Preserve core Block identity when extension data is added or removed.

## Release evidence

- [ ] Record implementation and toolchain versions.
- [ ] Record the exact ALX release/tag and suite-manifest checksum tested.
- [ ] Publish native-test and portable-runner results, including skips.
- [ ] Re-run deterministic operations and order perturbations.
- [ ] Document implementation-specific resource limits without broadening protocol validity.
- [ ] Avoid calling the implementation conformant until every applicable gate passes.

## Related documents

- [`language-implementation-guide.md`](./language-implementation-guide.md) — implementation sequence and pitfalls
- [`conformance.md`](./conformance.md) — conformance model
- [`implementation-compatibility-matrix.md`](./implementation-compatibility-matrix.md) — maintained implementation parity
- [`../../CONFORMANCE.md`](../../CONFORMANCE.md) — public conformance entry point
