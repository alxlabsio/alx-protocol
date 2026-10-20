# ALX Test-Vector Format Policy

`protocol/suites.json` declares the vector-format version independently from the ALX protocol version.

- A vector-format major version changes when an existing consumer must change how it discovers, parses, dispatches, or compares a suite.
- New optional manifest metadata is backward-compatible only when older consumers may safely ignore it.
- Changing a required field, operation meaning, comparison meaning, vector ID, or existing expected result requires compatibility and protocol-impact review.
- Adding a vector for behavior already fixed by ALX v1 is compatible with the vector format, but changes the corpus digest and must be recorded in `CHANGELOG.md`.
- Removed or replaced vectors remain documented by stable ID in the changelog. IDs are never silently reused.

The suite manifest's `comparison` field is the suite default. A vector-level `comparison` field overrides it for mixed-operation suites. Every `validateGraph` vector uses `"comparison": "exact"`: the returned object must equal the complete expected result, including required fields, nested context, counts, ordered collections, issues, and any `limitReached` value. Missing fields, extra fields, different array order, and projected summaries fail exact comparison. JSON object member order is not significant.

Canonical schema identifiers are network-independent identifiers. Released schemas are distributed with the repository and conformance runners resolve them locally.

## Related Documents

- [`../protocol/suites.json`](../protocol/suites.json)
- [`../protocol/schemas/suite-manifest.schema.json`](../protocol/schemas/suite-manifest.schema.json)
- [`../protocol/schemas/test-vector.schema.json`](../protocol/schemas/test-vector.schema.json)
- [`../protocol/schemas/expected-results.schema.json`](../protocol/schemas/expected-results.schema.json)
- [`../protocol/schemas/graph-validation-request.schema.json`](../protocol/schemas/graph-validation-request.schema.json)
- [`../protocol/schemas/graph-verification.schema.json`](../protocol/schemas/graph-verification.schema.json)
- [`CHANGELOG.md`](CHANGELOG.md)
