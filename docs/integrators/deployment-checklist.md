# Production Readiness Checklist

The document helps teams prepare ALX Protocol-based product integrations for production. Production readiness guidance remains outside the protocol specification.

---

## Purpose

A step-by-step checklist for teams preparing ALX Protocol integrations for production use. Covers SDK configuration, storage, security, monitoring, optional external checkpoint integrations, and upgrade planning.

## Scope

Production readiness concerns for systems that create, store, retrieve, and validate Blocks. Optional checkpoint integrations are external integration candidates and remain outside ALX core validity.

## Non-Goals

- Protocol specification (see [`protocol/spec.md`](../../protocol/spec.md))
- SDK implementation details (see [`api-reference.md`](./api-reference.md))
- Settlement policy or economic design (see [`settlement.md`](./settlement.md))
- Smart contract development or auditing

---

## 1. Pre-Deployment

### SDK Version Pinning

- [ ] Pin `@alx-protocol/sdk` to an exact version in `package.json` (no `^` or `~`).
- [ ] Record the pinned version and its corresponding `ALX_PROTOCOL_VERSION` value.
- [ ] Verify the SDK version matches across all services that exchange Blocks.

### Conformance Test Suite

- [ ] Run the full conformance test suite against the integration (`npm test` or equivalent).
- [ ] Confirm all test vectors from `protocol/test-vectors/` pass.
- [ ] Verify that invalid Blocks are correctly rejected (negative test cases).

### Round-Trip Hash Test

- [ ] Execute the full round-trip cycle: `createBlock` -> store -> retrieve -> `validateBlock`.
- [ ] Confirm the retrieved Block's `blockHash` matches the originally created hash.
- [ ] Confirm `contentHash` survives the round trip without mutation.
- [ ] Run this test against the actual production storage backend, not just in-memory.

---

## 2. Storage

### Backup Strategy For Block Data

- [ ] Define a backup schedule for all persisted Blocks.
- [ ] Verify that backups preserve Block data byte-for-byte (no re-encoding or transformation).
- [ ] Test restore from backup and validate restored Blocks with `validateBlock`.

### Replication And Availability

- [ ] Define the availability target for Block retrieval (e.g., 99.9%).
- [ ] Configure replication appropriate to the storage backend.
- [ ] Verify that replicated copies produce identical `blockHash` values.

### Storage Backend Selection Criteria

- [ ] Confirm the backend preserves content exactly as written (no normalization, no charset conversion).
- [ ] Verify the backend supports the expected read/write throughput.
- [ ] Confirm the backend enforces size limits at or above the deployment maximum Block content size.
- [ ] Review [`storage.md`](./storage.md) for protocol-level storage independence guarantees.

---

## 3. Security

### Input Validation

- [ ] Enforce a maximum `content` size limit appropriate to the application.
- [ ] Enforce a maximum Graph depth limit to prevent excessive traversal.
- [ ] Validate that `parentHashes` references resolve to known Blocks before accepting a new Block.
- [ ] Reject Blocks with malformed or missing required fields.

### Hash Verification On Ingest

- [ ] Recompute `blockHash` on every Block received from external sources.
- [ ] Reject any Block where the recomputed hash does not match the declared `blockHash`.
- [ ] Recompute `contentHash` independently and verify it matches.

### Signing Configuration (If Using EIP-712)

- [ ] Configure the EIP-712 domain separator for the deployment environment.
- [ ] Verify signer addresses against an allowlist or registry.
- [ ] Store signatures alongside Blocks but do not modify Block content to include them.

### Replay Protection (If Using Signed Requests)

- [ ] Include a nonce or timestamp in signed payloads.
- [ ] Track consumed nonces to prevent replay.
- [ ] Define a maximum age for signed requests.

---

## 4. Content Governance

ALX inspects no content. PII, regulated data, and policy violations inside a Block are invisible to the protocol. Content inspection must complete before calling `createBlock`.

> Treat `createBlock` as the point of no return. Content cannot be modified after locking without invalidating the Block.

- [ ] Apply DLP scanning to content before calling `createBlock`.
- [ ] Enforce data classification policies: do not lock content that exceeds the permitted sensitivity level for the target storage or transit path.
- [ ] Verify consent and purpose-limitation for any personal data included in `content`.
- [ ] Apply data residency checks before locking Blocks that will be stored or transmitted across jurisdictions.
- [ ] Log content inspection decisions for audit purposes before Block creation. The Block itself does not carry an inspection audit trail.
- [ ] Verify that content complies with applicable regulations (GDPR, HIPAA, SOC 2, and equivalents) before calling `createBlock`.

---

## 5. Monitoring

### Validation Failure Rate

- [ ] Instrument `validateBlock` calls and track failure rate.
- [ ] Alert on validation failure rate exceeding a defined threshold (e.g., >0.1%).
- [ ] Log failed validation details (hash mismatch type, source) for debugging.

### Graph Integrity Checks

- [ ] Schedule periodic `validateGraph` runs against stored Block sets.
- [ ] Alert on any orphaned references (parentHashes pointing to missing Blocks).
- [ ] Track Graph size (total Block count, maximum depth) over time.

### Storage Growth Tracking

- [ ] Monitor total storage consumption for Block data.
- [ ] Project growth rate and plan capacity accordingly.
- [ ] Alert on unexpected growth spikes.

### Recommended Metrics

| Metric | Description |
|---|---|
| `alx.blocks.created` | Blocks created per time period |
| `alx.blocks.validated` | Blocks validated per time period |
| `alx.blocks.validation_failures` | Validation failures per time period |
| `alx.graph.depth_max` | Maximum Graph depth observed |
| `alx.graph.block_count` | Total Blocks in the Graph |
| `alx.storage.bytes_total` | Total storage consumed by Block data |

---

## 6. External Checkpoint Integrations

On-chain checkpoint integrations are external integration candidates. ALX core validity excludes on-chain checkpoint integrations.

Block creation, Block identity, lineage validation, local verification, Trace generation, and protocol conformance require no external networks, deployed services, or registries.

Teams that add checkpoint integrations should:

- [ ] Verify external deployment evidence independently.
- [ ] Keep external checkpoint addresses and network configuration outside Block identity.
- [ ] Store checkpoint configuration outside core protocol data.
- [ ] Treat checkpoint failures as integration failures, not core verification failures.
- [ ] Verify that checkpoint Merkle roots match the off-chain Graph state before submission.
- [ ] Store Attestor private keys in a hardware security module or secrets manager.
- [ ] Implement key rotation procedures for any integration keys.

Settlement falls outside ALX core validity. Settlement is an optional product or application-layer extension for systems that need economic coordination around verified artifacts.

---

## 7. Upgrade Path

### SDK Version Upgrades

- [ ] Review the SDK changelog before upgrading.
- [ ] Run the full conformance test suite after upgrading.
- [ ] Re-execute the round-trip hash test with the new SDK version.
- [ ] Coordinate upgrades across all services that exchange Blocks.

### Protocol Version Checking

- [ ] Check `ALX_PROTOCOL_VERSION` at application startup and log it.
- [ ] Verify that all communicating services agree on the protocol version.
- [ ] Implement version mismatch detection when receiving Blocks from external sources.

### Migration Considerations

- [ ] Review [`governance/migration.md`](../governance/migration.md) before any protocol version upgrade.
- [ ] Verify that existing stored Blocks remain valid under the new version.
- [ ] Plan a rollback strategy in case the upgrade introduces issues.

---

## Related Documents

- [`storage.md`](./storage.md) - Storage independence and backend patterns
- [`api-reference.md`](./api-reference.md) - SDK function reference
- [`governance/stability.md`](../governance/stability.md) - Protocol stability guarantees
- [`governance/migration.md`](../governance/migration.md) - Protocol version migration guidance
