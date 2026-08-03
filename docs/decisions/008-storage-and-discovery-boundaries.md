# 008: Storage And Discovery Boundaries

- **Status:** Accepted
- **Audience:** SDK integrators, application developers, network implementers
- **Authority:** Repository terminology and architecture; protocol behavior remains governed by [`../../protocol/spec.md`](../../protocol/spec.md)
- **Last reviewed:** 2026-08-03

## Decision

Public terminology follows the object’s actual role:

| Meaning | Term |
|---|---|
| Connected Blocks | Graph |
| Arbitrary list of Blocks or hashes | Block collection |
| Blocks available in one application | Local Block Store |
| Portable published list | Manifest Block |

A Manifest Block is a planned optional content profile, separate from protocol primitives. Implementation begins when an application needs to publish, sign, version, or exchange a list of Block hashes.

Local database indexes remain application infrastructure outside the Block model. XNDR.network owns public discovery, including Block location, publisher discovery, storage endpoint resolution, service capability advertisement, and supported content-profile publication. XNDR.network remains planned infrastructure pending a separate implementation and specification.

## Local Block Store

Local persistence belongs in the optional application adapter layer:

```typescript
interface BlockStore {
  put(block: Block): Promise<void>;
  get(blockHash: string): Promise<Block | null>;
  list(): Promise<BlockSummary[]>;
  has(blockHash: string): Promise<boolean>;
  remove(blockHash: string): Promise<void>;
}
```

The initial package includes memory, IndexedDB, and filesystem adapters. Application teams supply database adapters and select database engines.

The boundary has four consequences:

1. Storage writes change local availability while preserving Block identity.
2. Store listings report local availability; parentHashes define Graph structure.
3. Parent relationships between available Blocks form the Graph.
4. Removing a Block locally changes availability without invalidating its identity.

## Protocol Impact

This decision introduces no canonicalization, hash derivation, Block validity, lineage, Trace, signing, or conformance behavior. Storage and network discovery remain outside the protocol core.

## Migration

The migration removes obsolete content profiles, command routes, helper APIs, pointer-resolution paths, and contract names and omits compatibility shims. Batch anchoring uses transaction-batch terminology; portable membership remains application-owned.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../integrators/storage.md`](../integrators/storage.md)
- [`../integrators/adapters.md`](../integrators/adapters.md)
- [`../../adapters/README.md`](../../adapters/README.md)
