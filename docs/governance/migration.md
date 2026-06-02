# Upgrade And Migration Guide

The document explains migration guidance. Migration guidance remains outside the protocol specification.

---

## Purpose

Guide integrators through SDK version upgrades and protocol version transitions.

## Scope

Covers SDK upgrades within the same protocol version and migration strategies for future protocol version changes.

## Non-Goals

Excludes smart contract upgrades (contracts are immutable once deployed) and storage-layer migrations (storage is outside the protocol boundary).

---

## SDK Upgrades (Same Protocol Version)

### Checking The Installed SDK Version

```js
import { ALX_PROTOCOL_VERSION } from "@alx-protocol/sdk";
console.log(ALX_PROTOCOL_VERSION); // "1"
```

The implementer checks the installed SDK version:

```bash
npm list @alx-protocol/sdk
```

### Upgrade Procedure

1. **Update the dependency:**
   ```bash
   npm install @alx-protocol/sdk@latest
   ```

2. **Run the conformance test suite:**
   ```bash
   npx alx test-vectors run
   ```
   All core vectors must pass. If any fail, the upgrade introduced a regression - file an issue.

3. **Run application tests.** Verify that Blocks created before the upgrade still validate after.

4. **Check the changelog** for deprecation notices or new features.

### Upgrade Expectations

Within the same protocol version (e.g., SDK 1.0 to 1.x):

- All existing Blocks remain valid
- All test vectors produce identical output
- No data migration is required
- New optional parameters may be available

---

## Protocol Version Changes

When a future protocol version is released (e.g., v1 to v2), the migration path depends on what changed.

### Protocol Version Change Detection

```js
import { ALX_PROTOCOL_VERSION } from "@alx-protocol/sdk";

if (ALX_PROTOCOL_VERSION !== "1") {
  console.warn(`Expected protocol v1, running v${ALX_PROTOCOL_VERSION}`);
}
```

### Impact Assessment

| Change type | Data impact | Action required |
|-------------|-------------|-----------------|
| New canonicalization rule | Existing Blocks may hash differently | Re-create affected Blocks |
| New Block fields | Existing Blocks are still valid | No action for existing data |
| Changed hash algorithm | All Blocks hash differently | Full re-creation required |
| New Graph validation rules | Existing Graphs may have new issues | Re-validate all Graphs |

### Parallel Operation During Migration

If a protocol version change affects hashing, parallel operation may require two SDK versions simultaneously:

1. **Read path:** Accept Blocks from both v1 and v2 by checking which version validates
2. **Write path:** Create all new Blocks with the target version
3. **Migration:** Re-create v1 Blocks as v2 Blocks when convenient

Since Blocks carry no internal version marker, maintain a mapping between `blockHash` and the protocol version that created each Block in the storage layer.

### Preserving Lineage Across Versions

A v2 Block can reference a v1 Block's `blockHash` as a parent - `parentHashes` are opaque references. The protocol does not require parents to be the same version. However, `verifyGraph()` will fail for mixed-version Graphs if the `computeHash` function only handles one version.

### Verification Context During Migration

Mixed-version verification requires explicit context outside the v1 Block primitive. At minimum, migration tooling should maintain:

- which protocol version applies to each Block or Graph segment
- which verifier implementation handles each protocol version
- whether a Graph result is only structurally valid, cryptographically valid, or complete within the selected validation boundary

See [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) for the accepted architecture. Future normative specifications will define any standardized envelope or context format.

---

## Rollback Procedure

If an upgrade causes issues:

1. **Pin the previous SDK version:**
   ```bash
   npm install @alx-protocol/sdk@1.0.0
   ```

2. **Verify conformance:**
   ```bash
   npx alx test-vectors run
   ```

3. **Verify existing data:**
   ```js
   for (const block of loadAllBlocks()) {
     const result = validateBlock(block);
     if (!result.ok) console.error(`Regression: ${block.blockHash}`);
   }
   ```

SDK downgrades within the same protocol version are always safe - the protocol guarantees that Stable operations produce identical output.

---

## Related Documents

- [`./stability.md`](./stability.md) - stability tiers and compatibility guarantees
- [`./versioning.md`](./versioning.md) - version numbering policy
- [`./evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) - accepted evolution and completeness model
- [`../integrators/deployment-checklist.md`](../integrators/deployment-checklist.md) - production readiness
- [`../integrators/api-reference.md`](../integrators/api-reference.md) - current API surface
