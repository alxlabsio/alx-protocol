# Index Blocks (`alx.index`)

Audience: Integrators, platform operators  

**Off-chain trust inclusion uses `alx.index`.** Platforms publish Index Blocks listing which `blockHash` values are **available** or **approved** on that platform. Consumers combine `validateBlock` with an index membership check. **ALX anchor** on Base is optional and separate.

---

## Purpose

Define the off-chain index convention for platform registration workflows: hash match locally, inclusion in `alx.index` for policy.

## `alx.index` vs `alx.registry`

| `content.type` | Role |
|----------------|------|
| **`alx.registry`** | Steward or platform **catalog** (products, docs, registered platforms) |
| **`alx.index`** | Platform **index** of Blocks available or approved for trust |

```text
ALX catalog (alx.registry)  →  lists platforms and steward entries
Platform index (alx.index) →  lists blockHashes clients should accept
```

---

## Trust check (default)

```text
1. validateBlock(block)           → integrity (required)
2. blockHash ∈ platform alx.index → inclusion / approval (policy)
3. optional: blockHash ∈ ALX alx.registry catalog (steward policy)
4. optional: ALX anchor on Base   → neutral timestamp (rare)
```

---

## Platform index Block

1. Lock a Block with `content.type: "alx.index"`.
2. Set `issuer` to the platform id (for example `acme-agent-platform`).
3. Add `entries[]` with required `blockHash`; optional `status`, `cid`, `label`.
4. Revise by publishing a **new** Index Block with `parentHashes` pointing at the prior index (index **blockchain**).

```javascript
import { createBlock } from "@alx-protocol/sdk";
import {
  buildIndexBlockContent,
  validateIndexBlockContent,
  isBlockHashInIndex,
} from "@alx-protocol/cli/lib/registry-block.js";

const content = buildIndexBlockContent("acme-agent-platform", [
  {
    blockHash: "0x" + "a".repeat(64),
    status: "approved",
    cid: "bafybei...",
    label: "Security review workflow v3",
  },
  {
    blockHash: "0x" + "b".repeat(64),
    status: "available",
    cid: "bafybei...",
  },
]);

const check = validateIndexBlockContent(content);
const indexBlock = createBlock(content, [previousIndexBlockHash]);

isBlockHashInIndex("0x" + "a".repeat(64), content, { approvedOnly: true }); // true
```

### CLI

```bash
alx index validate platform-index.block.json
alx index check 0x<blockHash> --file platform-index.block.json
alx index check 0x<blockHash> --file platform-index.block.json --approved-only
```

---

## Informative `content` shape

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `alx.index` |
| `version` | Yes | Convention version (for example `"1"`) |
| `issuer` | Yes | Platform id |
| `entries` | Yes | Index rows |
| `entries[].blockHash` | Yes | Listed Block identity |
| `entries[].status` | Optional | `available`, `approved`, `published`, `withdrawn` |
| `entries[].cid` | Optional | Where to fetch Block JSON |
| `entries[].label` | Optional | Human-readable title |

Validate with `validateIndexBlockContent` before locking.

---

## HTTP retrieval

A platform MAY expose the same data via [`alx retrieval start`](../../cli/README.md) / [`protocol/retrieval-api.yaml`](../../protocol/retrieval-api.yaml). The Index Block remains the portable, verifiable source; HTTP is a mirror.

---

## Related Documents

- [`registry-blocks.md`](registry-blocks.md) — `alx.registry` catalogs
- [`glossary.md`](glossary.md) — blockchain, blockset, ALX anchor
- [`on-chain-base.md`](on-chain-base.md) — ALX anchor on Base
- [`storage.md`](storage.md) — fetch and resolve
