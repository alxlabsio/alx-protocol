# Database Schema Design Guide

The document recommends storage patterns for ALX Blocks. Storage patterns remain outside the protocol specification.

---

## Purpose

Provide concrete schema designs, queries, and operational patterns for persisting ALX Blocks in relational and document databases. Integrators can use this guide as a starting point for production storage layers.

## Scope

- PostgreSQL, SQLite, and MongoDB schema designs
- Index strategies for common access patterns
- SQL for retrieval, lineage traversal, deduplication, and batch operations
- Reconstructing a Graph from database rows for use with `buildGraph` and `traceAttribution`

## Non-Goals

- Defining protocol behavior. Storage is outside the protocol boundary. A Block is valid when its hash matches its content and parents, regardless of storage location.
- Mandating a specific database engine. Any storage backend that preserves the four Block fields (`blockHash`, `contentHash`, `parentHashes`, `content`) is conformant.
- Replication, backup, or high-availability architecture. These are infrastructure concerns.

---

## Schema Design

### Minimal Schema

The minimal table mirrors the four Block fields directly:

| Column | Type | Constraint | Maps to |
|---|---|---|---|
| `block_hash` | TEXT | PRIMARY KEY | `blockHash` |
| `content_hash` | TEXT | NOT NULL | `contentHash` |
| `parent_hashes` | JSON array | NOT NULL | `parentHashes` |
| `content` | JSON | NOT NULL | `content` |

This is the smallest correct schema. Applications MAY add columns (e.g., `created_at`, `source`, `version`) but MUST preserve these four.

### PostgreSQL

```sql
CREATE TABLE blocks (
    block_hash    TEXT PRIMARY KEY,
    content_hash  TEXT NOT NULL,
    parent_hashes JSONB NOT NULL DEFAULT '[]',
    content       JSONB NOT NULL
);
```

PostgreSQL `JSONB` is preferred over `JSON`: `JSONB` supports indexing, containment operators (`@>`), and efficient equality checks.

### SQLite

```sql
CREATE TABLE blocks (
    block_hash    TEXT PRIMARY KEY,
    content_hash  TEXT NOT NULL,
    parent_hashes TEXT NOT NULL DEFAULT '[]',
    content       TEXT NOT NULL
);
```

SQLite stores JSON as TEXT. Use `json_each()` for querying into `parent_hashes`. SQLite enforces no JSON validity at the schema level; the application MUST validate JSON before insertion.

### MongoDB

```javascript
// Document model
{
  _id: "0xabc123...def",          // blockHash as document ID
  contentHash: "0x987654...321",
  parentHashes: ["0xaaa...", "0xbbb..."],
  content: { type: "ai.response", text: "..." }
}
```

Using `blockHash` as `_id` provides a unique primary index automatically and prevents duplicates. The `parentHashes` array can be indexed directly for lineage queries.

---

## Indices

### Primary Index

`block_hash` (unique, provided by the PRIMARY KEY constraint). Every Block lookup by hash is O(1) with this index.

### Content Deduplication Index

```sql
-- PostgreSQL / SQLite
CREATE INDEX idx_blocks_content_hash ON blocks (content_hash);
```

This index supports queries that find all Blocks sharing the same content, regardless of lineage. Two Blocks with identical content but different parents produce different `blockHash` values but the same `contentHash`.

### GIN Index On parentHashes (PostgreSQL)

```sql
CREATE INDEX idx_blocks_parent_hashes ON blocks USING GIN (parent_hashes);
```

The GIN index enables efficient containment queries on the JSONB array. Omitting the index forces a sequential scan when finding children of a Block.

### Attester Index (For Signed Blocks)

If blocks carry attestations, index the attester to quickly retrieve all blocks authored by a specific agent or platform:

```sql
-- PostgreSQL: extract attester from attestation JSONB
CREATE INDEX idx_blocks_attester ON blocks ((attestation->>'attester'))
  WHERE attestation IS NOT NULL;
```

### MongoDB Indices

```javascript
db.blocks.createIndex({ contentHash: 1 });
db.blocks.createIndex({ parentHashes: 1 });
db.blocks.createIndex({ "attestation.attester": 1 }, { sparse: true });
```

MongoDB automatically indexes `_id`. The `parentHashes` multikey index supports `$elemMatch` and `$in` queries for lineage traversal.

---

## Common Queries

### Retrieve A Block By Hash

```sql
SELECT block_hash, content_hash, parent_hashes, content
FROM blocks
WHERE block_hash = $1;
```

### Find All Children Of A Block

Find every Block whose `parentHashes` contains a given hash. These are Blocks that directly reference the target as a parent.

**PostgreSQL (JSONB containment):**

```sql
SELECT block_hash, content_hash, parent_hashes, content
FROM blocks
WHERE parent_hashes @> $1::jsonb;
-- $1 = '["0xabc123..."]' (JSON array containing the target hash)
```

**SQLite (json_each):**

```sql
SELECT b.block_hash, b.content_hash, b.parent_hashes, b.content
FROM blocks b, json_each(b.parent_hashes) AS ph
WHERE ph.value = $1;
-- $1 = '0xabc123...' (the target hash as a plain string)
```

### Find All Ancestors Using Recursive CTE

Traverse the full lineage of a Block, walking from child to parent recursively:

```sql
WITH RECURSIVE ancestors AS (
    -- Base case: the starting Block
    SELECT block_hash, content_hash, parent_hashes, content, 0 AS depth
    FROM blocks
    WHERE block_hash = $1

    UNION

    -- Recursive case: follow parentHashes upward
    SELECT b.block_hash, b.content_hash, b.parent_hashes, b.content, a.depth + 1
    FROM ancestors a, json_each(a.parent_hashes) AS ph
    JOIN blocks b ON b.block_hash = ph.value
)
SELECT DISTINCT block_hash, content_hash, parent_hashes, content, MIN(depth) AS min_depth
FROM ancestors
GROUP BY block_hash, content_hash, parent_hashes, content
ORDER BY min_depth;
```

This query works on both PostgreSQL and SQLite. For PostgreSQL with JSONB, replace `json_each` with `jsonb_array_elements_text`:

```sql
WITH RECURSIVE ancestors AS (
    SELECT block_hash, content_hash, parent_hashes, content, 0 AS depth
    FROM blocks
    WHERE block_hash = $1

    UNION

    SELECT b.block_hash, b.content_hash, b.parent_hashes, b.content, a.depth + 1
    FROM ancestors a
    CROSS JOIN LATERAL jsonb_array_elements_text(a.parent_hashes) AS ph(value)
    JOIN blocks b ON b.block_hash = ph.value
)
SELECT DISTINCT ON (block_hash) block_hash, content_hash, parent_hashes, content, depth AS min_depth
FROM ancestors
ORDER BY block_hash, depth;
```

### Find Root Blocks

Root Blocks have no parents. The `parentHashes` field for a root Block is an empty array:

```sql
-- PostgreSQL
SELECT block_hash, content_hash, parent_hashes, content
FROM blocks
WHERE parent_hashes = '[]'::jsonb;

-- SQLite
SELECT block_hash, content_hash, parent_hashes, content
FROM blocks
WHERE parent_hashes = '[]';
```

### Batch Insert With Conflict Handling

Insert multiple Blocks, skipping any that already exist. Because `blockHash` is deterministic (same content + same parents = same hash), a conflict on `block_hash` means the identical Block already exists.

```sql
-- PostgreSQL
INSERT INTO blocks (block_hash, content_hash, parent_hashes, content)
VALUES ($1, $2, $3, $4)
ON CONFLICT (block_hash) DO NOTHING;
```

```sql
-- SQLite
INSERT OR IGNORE INTO blocks (block_hash, content_hash, parent_hashes, content)
VALUES ($1, $2, $3, $4);
```

`ON CONFLICT DO NOTHING` is safe because two Blocks with the same `blockHash` are guaranteed to have the same content and parents. There is no risk of silently dropping a different Block.

---

## Batch Operations

### Bulk Import Pattern

When importing a large set of Blocks (e.g., from a JSON export or another system), use a single transaction with batch inserts:

```javascript
import { validateBlock } from "@alx-protocol/sdk";

async function bulkImport(db, blocks) {
  await db.query("BEGIN");
  try {
    const stmt = `
      INSERT INTO blocks (block_hash, content_hash, parent_hashes, content)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (block_hash) DO NOTHING
    `;
    for (const block of blocks) {
      // Validate before persisting
      const check = validateBlock(block);
      if (!check.ok) {
        throw new Error(`Invalid Block ${block.blockHash}: hash mismatch`);
      }
      await db.query(stmt, [
        block.blockHash,
        block.contentHash,
        JSON.stringify(block.parentHashes),
        JSON.stringify(block.content),
      ]);
    }
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
```

For very large imports (millions of Blocks), consider using PostgreSQL `COPY` or multi-row `INSERT` statements to reduce round trips.

### Graph Reconstruction From Database

The `buildGraph` and `traceAttribution` functions operate on in-memory data structures. Load the relevant rows and reconstruct a `Map<string, string[]>` before calling these functions with database-persisted Blocks:

```javascript
import { buildGraph, traceAttribution } from "@alx-protocol/sdk";

async function traceFromDatabase(db, rootHash) {
  // Step 1: Load all ancestors using the recursive CTE
  const { rows } = await db.query(`
    WITH RECURSIVE ancestors AS (
        SELECT block_hash, parent_hashes, 0 AS depth
        FROM blocks
        WHERE block_hash = $1

        UNION

        SELECT b.block_hash, b.parent_hashes, a.depth + 1
        FROM ancestors a
        CROSS JOIN LATERAL jsonb_array_elements_text(a.parent_hashes) AS ph(value)
        JOIN blocks b ON b.block_hash = ph.value
    )
    SELECT DISTINCT block_hash, parent_hashes FROM ancestors
  `, [rootHash]);

  // Step 2: Convert rows to the format buildGraph expects
  const blocks = rows.map(row => ({
    blockHash: row.block_hash,
    parentHashes: row.parent_hashes,  // JSONB is parsed automatically by most drivers
  }));

  // Step 3: Build the Graph and trace attribution
  const graph = buildGraph(blocks);
  const trace = traceAttribution(rootHash, graph);

  return trace;
}
```

The `buildGraph` function accepts an array of objects with `blockHash` and `parentHashes` fields and returns a `Map<string, string[]>`. The `traceAttribution` function accepts a root hash and this Map, and returns the complete `AttributionTrace` with nodes, edges, depths, pathCount values, and leaves.

### Pagination With Cursor-Based Approach

For large result sets, paginate using `blockHash` as a cursor. `blockHash` values are unique and lexicographically sortable (0x-prefixed hex), providing a stable cursor:

```sql
-- First page
SELECT block_hash, content_hash, parent_hashes, content
FROM blocks
ORDER BY block_hash
LIMIT 100;

-- Subsequent pages (cursor = last block_hash from previous page)
SELECT block_hash, content_hash, parent_hashes, content
FROM blocks
WHERE block_hash > $1
ORDER BY block_hash
LIMIT 100;
```

This approach avoids the performance problems of `OFFSET`-based pagination on large tables. The primary key index on `block_hash` makes the `WHERE block_hash > $1` filter efficient.

---

## Performance Considerations

### Index Sizing For Large Graphs

For Graphs with millions of Blocks:

- The primary key index on `block_hash` (64-character hex string) consumes approximately 100-120 bytes per entry including overhead. One million Blocks produce an index of roughly 110 MB.
- The GIN index on `parent_hashes` grows with the number of parent references. A Graph where each Block averages 2 parents produces a GIN index roughly 1.5-2x the size of the primary key index.
- The `content_hash` B-tree index is comparable in size to the primary key index.

Monitor index size with:

```sql
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'blocks';
```

### JSONB Vs Normalized Parent_Links Table

The minimal schema stores `parentHashes` as a JSONB array. An alternative is a normalized join table:

```sql
CREATE TABLE parent_links (
    child_hash  TEXT NOT NULL REFERENCES blocks(block_hash),
    parent_hash TEXT NOT NULL REFERENCES blocks(block_hash),
    PRIMARY KEY (child_hash, parent_hash)
);
```

**Tradeoffs:**

| Concern | JSONB array | Normalized table |
|---|---|---|
| Schema simplicity | Simpler, mirrors Block structure directly | Requires join for every Block retrieval |
| Write performance | Single row insert per Block | One insert per Block + one per parent link |
| Child lookup | GIN index with `@>` operator | Standard B-tree join, well-understood |
| Recursive traversal | `jsonb_array_elements_text` in CTE | Direct join in CTE, potentially faster at scale |
| Storage overhead | Compact for Blocks with few parents | Row overhead per link, but deduplicates hash storage |
| Portability | Works across PostgreSQL, SQLite, MongoDB | Relational-only pattern |

**Recommendation:** Start with the JSONB array — simpler schema, direct mapping to Block structure, and adequate performance for most workloads. Consider the normalized table when recursive traversal queries become a bottleneck at scale (typically beyond 10 million Blocks with deep lineage chains).

### Connection Pooling For High-Throughput Block Creation

When creating Blocks at high throughput (e.g., an AI agent producing hundreds of Blocks per minute):

- Use a connection pool (e.g., `pg-pool` for PostgreSQL) with a pool size matched to the database's `max_connections` setting.
- Batch inserts within a single transaction to reduce per-statement overhead. Groups of 100-500 Blocks per transaction provide a reasonable balance between latency and throughput.
- Use prepared statements to avoid repeated query parsing. The `INSERT ... ON CONFLICT DO NOTHING` pattern is safe to prepare because the statement structure never changes.
- Consider asynchronous writes when Block creation latency is critical. Write Blocks to an in-memory buffer and flush to the database in background batches. The protocol validates Blocks by hash rather than by storage confirmation, so the application can proceed before the write completes.

---

## Related Documents

- [`./storage.md`](./storage.md) -- storage independence principle and adapter interface
- [`./quickstart.md`](./quickstart.md) -- five-minute introduction to creating and tracing Blocks
- [`./api-reference.md`](./api-reference.md) -- full SDK API reference including `buildGraph` and `traceAttribution`
- [`deployment-checklist.md`](./deployment-checklist.md) -- operational checklist for production deployments
