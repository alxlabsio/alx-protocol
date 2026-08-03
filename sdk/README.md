# @alx-protocol/sdk

TypeScript/JavaScript SDK for ALX Protocol — an open standard that gives every AI-generated artifact a deterministic identity, verifiable lineage, and traceable attribution.

## Install

```bash
npm install @alx-protocol/sdk
```

## Quickstart

ALX Protocol derives deterministic Block identity from content and parent hashes. `validateBlock()` recomputes stored identities, and Graph operations validate and traverse declared lineage. Applications select their own storage layer.

The example creates a financial risk report Block, adds a signed compliance review, validates the Graph, traces lineage, and detects modified Block data.

```ts
import {
  createBlock,
  createSignedBlock,
  validateBlock,
  validateSignedBlock,
  buildGraph,
  validateGraph,
  traceAttribution,
} from "@alx-protocol/sdk";

// Step 1: AI generates a draft financial risk summary
const report = createBlock({
  workflow: "compliance-audit-trail",
  task: "generate-financial-risk-summary",
  agentRole: "report-generation-agent",
  summary: "Moderate liquidity risk due to increased debt obligations and uneven cash flow.",
  riskLevel: "medium",
  outputType: "draft-report",
});

console.log(report.blockHash);          // deterministic identity
console.log(validateBlock(report).ok);  // true

// Step 2: Compliance reviewer checks the report and signs their review
// (Use any Signer — EIP-712, Ed25519, cloud KMS, or a mock for testing)
const reviewSigner = {
  algorithm: "ed25519",
  getId: async () => "compliance-reviewer-001",
  sign: async (data) => "0x" + Buffer.from(data).toString("hex"), // mock
};

const review = await createSignedBlock(
  {
    workflow: "compliance-audit-trail",
    task: "review-financial-risk-summary",
    agentRole: "compliance-review-agent",
    reviewStatus: "changes-required",
    findings: [
      { issue: "Risk summary lacks source references.", severity: "medium" },
      { issue: "Confidence score missing.", severity: "low" },
    ],
    outputType: "compliance-review",
  },
  [report.blockHash],  // ← linked to the original report
  reviewSigner,
);

console.log(review.attestation.attester);   // "compliance-reviewer-001"
console.log(review.attestation.algorithm);  // "ed25519"

// Step 3: Validate the full pipeline
const graph = buildGraph([report, review]);
console.log(validateGraph(graph).ok);  // true — no cycles, no missing parents

// Step 4: Trace attribution from the review back to the source
const trace = traceAttribution(review.blockHash, graph);
console.log(trace.nodes.length);  // 2
console.log(trace.leaves);        // [report.blockHash] — the original source

// Step 5: Tamper detection — any change invalidates the chain
const tampered = { ...report, content: { ...report.content, riskLevel: "low" } };
console.log(validateBlock(tampered).ok);  // false — integrity broken
```

The workflow produces linked Blocks for a report and review. The attestation remains outside Block identity. `validateBlock()` detects changes when stored identities no longer match recomputed values. PostgreSQL, S3, IPFS, and flat files are application storage options.

## API Overview

| Layer | Functions & Types |
|-------|-------------------|
| Canonicalization | `canonicalizeProtocolJson`, `CANONICALIZATION_ALGORITHM` |
| Block Operations | `createBlock`, `validateBlock`, `deriveBlockHash`, `deriveContentHash` |
| Signed Blocks | `createSignedBlock`, `validateSignedBlock`, `Signer`, `Verifier` |
| Graph Validation | `validateLineage`, `validateGraph`, `buildGraph`, `verifyGraph` |
| Attribution Tracing | `traceAttribution`, `TraceNode`, `TraceEdge`, `AttributionTrace` |
| Merkle Proofs | `buildMerkleTree`, `getMerkleProof`, `verifyMerkleProof` |
| EIP-712 Signing | `Eip712Signer`, `Eip712Verifier` (requires `ethers` peer dependency) |
| Replay Protection | `buildReplayScopeKey`, `validateReplayWindow` |
| Hash Utilities | `normalizeHash`, `normalizeHashes`, `sanitizeImportedParentHashes`, `HASH_PATTERN`, `compareHashesConstantTime` |
| Error Codes | `ErrorCode`, `protocolError` (all errors prefixed with `ALX_*`) |

Sub-path imports are available for tree-shaking:

```ts
import { createBlock } from "@alx-protocol/sdk/block";
import { buildMerkleTree } from "@alx-protocol/sdk/merkle";
import { Eip712Signer } from "@alx-protocol/sdk/eip712";
```

## Imported Parent Hashes

Use `sanitizeImportedParentHashes()` when an importer must inspect untrusted lineage data before deciding whether to reject, quarantine, or repair a source record.

```ts
import {
  createBlock,
  sanitizeImportedParentHashes,
} from "@alx-protocol/sdk";

const importedParents: unknown = [
  "0x" + "A".repeat(64),
  "invalid",
];
const inspection = sanitizeImportedParentHashes(importedParents);

if (!inspection.ok) {
  console.error(inspection.rejected, inspection.collectionErrors);
} else {
  const block = createBlock(
    { task: "review-imported-market-research" },
    inspection.parentHashes,
  );
  console.log(block.blockHash);
}
```

The result reports rejected values, normalized duplicates, and collection overflow. `parentHashes` is sorted and unique. Callers use it only when `ok` is `true`. Core Block creation does not call the sanitizer and remains fail closed.

## Documentation

- [Five-Minute Quickstart](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/quickstart.md)
- [API Reference](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/api-reference.md)
- [FAQ](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/faq.md)
- [Troubleshooting](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/troubleshooting.md)
- [ALX Protocol Specification](https://github.com/xandrlabs/alx-protocol/blob/main/protocol/spec.md)
- [Full Documentation Index](https://github.com/xandrlabs/alx-protocol/blob/main/docs/README.md)

## Adapters

This SDK is the protocol core. Optional [adapters](https://github.com/xandrlabs/alx-protocol/tree/main/adapters) extend it to external systems (IPFS, MCP, EAS) without changing Block identity, hashing, or validation semantics. Adapters import from `@alx-protocol/sdk` — the protocol flows outward, never inward.

## Protocol conformance

This SDK passes all 92 core conformance vectors. External TypeScript, Python, and Rust adapter runs cover 84 portable cases; native suites cover the eight language-specific cases.

```bash
npx @alx-protocol/cli test-vectors run
```

## License

MIT

## Related Documents

- [Protocol specification](../protocol/spec.md)
- [Canonical test vectors](../protocol/test-vectors/README.md)
