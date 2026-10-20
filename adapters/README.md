# ALX Application Adapters

- **Status:** Optional application package; not yet published to npm, so use it from a repository checkout
- **Audience:** Application and infrastructure developers
- **Authority:** Non-normative; protocol behavior remains governed by [`../protocol/spec.md`](../protocol/spec.md)
- **Last reviewed:** 2026-08-03

`@alx-protocol/adapters` provides local persistence interfaces and implementations outside the protocol core.

```typescript
import { createBlock } from "@alx-protocol/sdk";
import { MemoryBlockStore } from "@alx-protocol/adapters";

const store = new MemoryBlockStore();
const block = createBlock({ type: "security.review", result: "approved" }, []);
await store.put(block);
```

Available adapters:

- `MemoryBlockStore` from `@alx-protocol/adapters`;
- `BrowserBlockStore` from `@alx-protocol/adapters/browser` using IndexedDB;
- `FileBlockStore` from `@alx-protocol/adapters/file`.

Applications can implement `BlockStore` for a database selected by the application. Saving or removing a Block changes local availability only. A stored collection is not itself a Graph; `parentHashes` define relationships among available Blocks.

## Related Documents

- [`../docs/integrators/storage.md`](../docs/integrators/storage.md)
- [`../docs/integrators/block-storage-adapters.md`](../docs/integrators/block-storage-adapters.md)
- [`../protocol/spec.md`](../protocol/spec.md)
