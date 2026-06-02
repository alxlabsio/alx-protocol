# ALX Glossary

Audience: Integrators, product teams, reviewers  

Canonical **protocol** terms (`Block`, `blockHash`, `Graph`, `Trace`, …) are defined in [`protocol/spec.md`](../../protocol/spec.md) and [`maintainer/docs/STYLE-GUIDE.md`](../STYLE-GUIDE.md). This glossary adds **informative product vocabulary** used in Xandr Labs docs and on-chain conventions.

---

## Purpose

Defines **blockchain** and **blockset** (one word each), minimum sizes, and relationship to normative terms — without conflating ALX **blockchain** with a ledger **blockchain network**.

---

## Normative core (quick reference)

| Term | Role |
|------|------|
| **Block** | Protocol primitive; one `blockHash` |
| **parentHashes** | Declared predecessors; binds lineage into identity |
| **Graph** | Blocks + `parentHashes` edges (DAG) |
| **lineage** | Derivation structure in the Graph |
| **Trace** | Output of `traceAttribution` |

---

## Informative product terms

### blockchain (one word)

A **blockchain** is an evolving derivation structure of **two or more** Blocks linked through `parentHashes`—at least one directed path where each Block after the first declares its predecessor in `parentHashes`.

- **Minimum size:** 2 Blocks on a derivation path (for example parent → child).
- **May grow** without bound as new Blocks are locked (workflow history, catalog chain of `alx.registry` Blocks).
- **Predecessor of blockset:** establish blockchains first; then group hashes into blocksets for releases, anchors, or catalogs.
- **Product shorthand (no protocol primitive):** the spec uses **Graph** and **lineage**; **blockchain** is shorthand for linked Blocks in product language.

**Avoid conflating with:**

| Say this | Not ALX **blockchain** |
|----------|-------------------------|
| **ALX anchor**, **Base** | On-chain **ALXAnchor** and rare commits |
| **Graph** | Full DAG when you mean the normative object |
| **block chain** (two words) | Deprecated spelling in ALX docs—use **blockchain** |

### blockset (one word)

A **blockset** is a **named set of two or more** `blockHash` values grouped for one product operation (release, audit bundle, `anchorBlockSet`, catalog slice).

- **Minimum size:** 2 hashes.
- **May include** hashes from one **blockchain** or several branches; members are free to span multiple paths.
- **Distinct from** **Graph** — the Graph is the full dependency structure; a blockset is an arbitrary bundle.

### Relationship

```text
Block (1)
  └── blockchain (2+ linked via parentHashes; grows over time)
        └── blockset (2+ hashes chosen for one operation)
```

| Question | Answer |
|----------|--------|
| Can a blockset have exactly 2 hashes? | Yes |
| Can a blockchain have exactly 2 Blocks? | Yes (parent + child) |
| Is a blockchain always larger than a blockset? | **No**—different axes (linkage vs grouping). A blockset of 2 can be one parent-child **blockchain**. |
| What is usually “bigger”? | The **Graph** over time (many blockchains and blocksets). |

---

## Tooling

**Blockchain step (parentHashes):**

```bash
alx block link ./ai-response.json research.block.json child.block.json
alx block link ./follow-up.json @latest child.block.json
alx block list --recent
```

**Blockset (2+ hashes, off-chain manifest):**

```bash
alx blockset validate --hashes 0x<hash1>,0x<hash2>
alx blockset manifest --hashes 0x<hash1>,0x<hash2> --label "release bundle" --out release.blockset.json
```

Optional **ALX anchor**: `alx anchor create --blockset ...` on **ALXAnchor** (see [on-chain-base.md](on-chain-base.md)).

### ALX anchor (on-chain)

**ALX anchor** is the on-chain layer on Base (**ALXAnchor** contract)—optional existence-time for a `blockHash` or **blockset**. Optional Base CID pointer reads for `alx block resolve --chain base` are documented in [on-chain-base.md](on-chain-base.md#optional-base-reads-reference) without naming historical deployments.

- **Distinct from** **blockchain** — off-chain Blocks linked via `parentHashes`.
- **Distinct from** **`alx.index`** and **`alx.registry`** — those stay off-chain.

### alx.index (off-chain)

**`alx.index`** — platform Index Blocks (available / approved `blockHash` list). See [`index-blocks.md`](index-blocks.md).

### alx.registry (off-chain)

**`alx.registry`** — steward or platform catalog. See [`registry-blocks.md`](registry-blocks.md).

### Full map

```text
Block
  └── blockchain (off-chain, parentHashes)
        └── blockset (off-chain, 2+ hashes)
              ├── alx.index   (off-chain inclusion / approval)
              ├── alx.registry (off-chain catalog)
              └── ALX anchor  (on-chain, rare — ALXAnchor on Base)
```

Trust default: **`validateBlock`** + **`alx.index`** (+ optional **`alx.registry`**). **ALX anchor** only for neutral on-chain time.

---

## Maintainer source

Machine-readable keyword list: [`maintainer/brand/protocol-terminology.yaml`](../../maintainer/brand/protocol-terminology.yaml) (gitignored maintainer layer). Vale spellings: [`maintainer/audit/docs/docs-writing/vocab/alx/accept.txt`](../../maintainer/audit/docs/docs-writing/vocab/alx/accept.txt).

---

## Related Documents

- [`registry-blocks.md`](registry-blocks.md) — `alx.registry` catalogs
- [`on-chain-base.md`](on-chain-base.md) — ALX anchor on Base
- [`protocol/spec.md`](../../protocol/spec.md) — normative terminology
- [`../STYLE-GUIDE.md`](../STYLE-GUIDE.md) — mandatory protocol terms
