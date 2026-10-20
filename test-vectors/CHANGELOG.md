# ALX Test-Vector Format Changelog

## Format 1

- Established `protocol/suites.json` as the sole canonical suite manifest.
- Added explicit operation, execution model, comparison, vector count, schema identifier, required status, and SHA-256 digest metadata.
- Classified vector `note` and `assertions` fields as informative.
- Added strict offline-validatable schemas for the manifest and vector envelopes.
- Added offline operation-specific expected-result schemas and required each suite to declare their canonical identifier.
- Added a deterministic SHA-256 release index covering the manifest, schemas, vectors, and protocol authorities.
- Replaced adjacency-only Graph outcome inputs with complete seed Blocks, finite Block sources, and verification contexts matching the accepted `validateGraph(seed, source, context)` contract.
- Replaced projected Graph expectations with complete Graph verification envelopes and exact per-vector comparison. Canonical issues are deterministic `{ code, blockHash }` records; cycle and self-reference vectors now expose independent Block-hash mismatches rather than hiding them behind a primary status assertion.
- Restored LB4's external-parent declaration so its closed-world rejection input exercises `ALX_EXTERNAL_PARENT_IN_CLOSED_WORLD` as described; its ID and expected output are unchanged.
- Added the required `raw-json-ingress` suite for fatal UTF-8 decoding, malformed JSON, duplicate members at every depth, and trailing-data rejection before ALX value construction.
- Added SI13 to reject duplicate Block candidates in Graph authenticity verification instead of silently overwriting one candidate.
- Added the required `graph-validation-interactions` suite for invalid-parent, duplicate-parent, depth-plus-one, precedence-interaction, deterministic missing-parent ordering, and malformed request-root cases.
- Added the required `trace-boundaries` suite for omitted, malformed, and unavailable roots and malformed Graph keys.
- Added SV9 to reject unknown received-Block fields instead of projecting them away.

Existing vector IDs were preserved. Graph expected outputs changed as an intentional prerelease v1 contract correction; non-Graph expected outputs were preserved.
