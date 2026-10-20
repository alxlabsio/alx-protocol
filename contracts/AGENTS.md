# Optional Contracts Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs `contracts/`.

## Role and boundary

`ALXAnchor` is an optional external existence-time integration. Contract acceptance does not validate a Block, establish content truth or authorship, compute a Trace, or become required for core conformance.

## Local invariants

- Treat submitted `bytes32` values as opaque contract inputs; application code validates complete Blocks before reliance.
- Preserve documented first-write, sender, timestamp, duplicate, batch, and event semantics.
- Keep administrator, upgrade, pause, token, fee, and authorization behavior absent unless explicitly authorized and reviewed as a contract redesign.
- Keep Merkle proof verification off-chain unless a separate versioned contract explicitly adds it.
- Do not describe a planned or undeployed address as active.
- Network, RPC, gas, finality, reorganization, and key-management policy remain external operational concerns.
- Never hard-code private keys or require ALX Labs infrastructure.

## Contract changes

- Update Solidity source, tests, ABI/generated artifact policy, README, chain configuration, gas/security assumptions, and deployment scripts together.
- Treat storage layout, event signatures, revert behavior, packing, batch bounds, and access control as security-sensitive.
- Do not deploy, verify, fund, or publish a contract without explicit authority and credentials.
- Keep deterministic local tests independent of live RPC endpoints.

## Verification

From the repository root:

```bash
pnpm --filter @alx-protocol/contracts run compile
pnpm --filter @alx-protocol/contracts run lint
pnpm run test:contracts
pnpm run format:check
```

For a release-facing contract change, also run the repository security/verification gates and require an independent-review decision appropriate to the risk.

## Stop conditions

Stop if protocol validity would depend on the contract, a deployment or private key is required, chain/address status is unknown, an upgrade/admin mechanism is introduced without governance, or source/ABI/deployment records cannot be kept aligned.

## Completion evidence

Report contract functions/events/storage affected, gas and compatibility impact, tests/lint/compile results, deployment status, network assumptions, audit status, and confirmation that core Block identity is unchanged.
