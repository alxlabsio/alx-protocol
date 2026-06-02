# IPFS Artifact Package Extension

Status: Provisional  
Audience: Implementers  
Authority: Non-core extension profile

This extension defines a storage manifest that maps ALX protocol identities to IPFS CIDs without changing the core `Block` primitive.

The manifest is intentionally non-normative for core ALX validity:

- `Block` identity remains `{ blockHash, contentHash, parentHashes, content }`
- IPFS CIDs address stored bytes
- the package manifest records the mapping between ALX hashes and retrievable IPFS objects

## Verification Boundary

Local package verification checks the manifest against package bytes.

For a package directory, a verifier may recompute CIDv1 values for:

- `block.json`
- `content.json`
- resolved parent Block files

and compare those values to `manifest.json`.

This proves that the manifest maps to the local bytes being verified. It does not prove that those bytes are pinned, available through a gateway, or retrievable from a live IPFS provider.

Live IPFS retrieval is an integration layer on top of this extension:

1. fetch bytes by CID;
2. parse the artifact package;
3. replay ALX package verification;
4. emit a receipt for the fetched package state.

## CLI Status

The current CLI supports local package verification:

```bash
alx package verify artifact-packages/security-review-decision --json
```

The output includes `cidVerified`.

```json
{
  "ok": true,
  "complete": true,
  "cidVerified": true,
  "missingParents": [],
  "externalParents": []
}
```

`cidVerified: true` means the manifest CIDs match the local package bytes. It is not a live pinning or gateway availability claim.

## Related Documents

- `protocol/spec.md`
- `protocol/extensions/ipfs-artifact-package/schemas/ipfs-artifact-package-manifest.schema.json`
- `docs/integrators/artifact-package-manifest.md`
