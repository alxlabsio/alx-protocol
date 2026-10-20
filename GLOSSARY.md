# Glossary

Status: public terminology index; canonical definitions remain in
[`protocol/spec.md`](./protocol/spec.md#terminology)

| Term | Meaning | Primary source |
|---|---|---|
| **ALX value** | A value admitted by the canonical ALX value model | [`protocol/spec.md`, ALX value model](./protocol/spec.md#alx-value-model) |
| **Block** | The sole ALX Protocol primitive, binding opaque content and declared direct parent identities | [`protocol/spec.md`, section 1](./protocol/spec.md#1-primitive) |
| **content** | Opaque application-defined data that must belong to the ALX value model | [`protocol/spec.md`, Terminology](./protocol/spec.md#terminology) |
| **contentHash** | Domain-separated identity of canonicalized `content` | [`protocol/spec.md`, section 3](./protocol/spec.md#3-identity) |
| **blockHash** | Domain-separated identity of canonicalized `content` and normalized `parentHashes` | [`protocol/spec.md`, section 3](./protocol/spec.md#3-identity) |
| **parentHashes** | Declared direct parent Block identities | [`protocol/spec.md`, Parent Hash Normalization](./protocol/spec.md#parent-hash-normalization) |
| **Graph** | Connected Block structure reachable from a seed through declared parents within a verification context | [`protocol/spec.md`, section 4](./protocol/spec.md#4-lineage) |
| **Block source** | Deterministic lookup boundary used by Graph verification; not a protocol primitive | [`protocol/spec.md`, Graph verification](./protocol/spec.md#graph-verification) |
| **Trace** | Deterministic structural attribution result over reachable Graph topology | [`protocol/spec.md`, section 5](./protocol/spec.md#5-attribution) |
| **pathCount** | Exact count of distinct paths from the Trace root to a reachable Block | [`protocol/spec.md`, Attribution semantics](./protocol/spec.md#semantics) |
| **closed-world validation** | Verification context in which every declared parent is required data | [`protocol/spec.md`, Closed-World Validation](./protocol/spec.md#closed-world-validation) |
| **open-world validation** | Explicit context allowing specifically declared external parent boundaries | [`protocol/spec.md`, Open-World Validation](./protocol/spec.md#open-world-validation) |
| **incomplete** | Graph verification could not finish because required Block data was unavailable and no higher-precedence result applied | [`protocol/spec.md`, Graph verification](./protocol/spec.md#graph-verification) |
| **resource_limit_reached** | Graph verification stopped at an execution budget and no known violation took precedence | [`protocol/spec.md`, Graph verification](./protocol/spec.md#graph-verification) |
| **extension** | Optional capability with rules and conformance separate from ALX Core | [`EXTENSIONS.md`](./EXTENSIONS.md) |
| **conformance** | Satisfaction of every applicable canonical requirement and required suite for the stated claim | [`CONFORMANCE.md`](./CONFORMANCE.md) |

Application indexes may use terms such as child, descendant, observation, or
neighborhood for derived views. Those terms do not add fields or relationships
to the canonical Block.

## Related documents

- [`SPECIFICATION.md`](./SPECIFICATION.md)
- [`IDENTITY.md`](./IDENTITY.md)
- [`GRAPH.md`](./GRAPH.md)
