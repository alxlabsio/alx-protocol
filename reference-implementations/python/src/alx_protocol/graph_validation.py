"""Canonical ALX v1 Graph verification over a finite Block source."""

from __future__ import annotations

from typing import Any, Callable

from alx_protocol.block import (
    MAX_PARENTS,
    derive_block_hash,
    derive_content_hash,
    normalize_hash,
)
from alx_protocol.verification_context import GraphVerification

MAX_SAFE_INTEGER = 2**53 - 1
BLOCK_FIELDS = {"blockHash", "contentHash", "parentHashes", "content", "protocolVersion"}
CONTEXT_FIELDS = {
    "protocolVersion",
    "validationMode",
    "graphRoot",
    "maxDepth",
    "resourceLimits",
    "extensions",
    "externalParents",
}
EXTERNAL_PARENT_FIELDS = {"hash", "reason", "declaredBy", "requiredForFullValidation"}
EXTERNAL_REASONS = {
    "external-boundary",
    "private-boundary",
    "unavailable-boundary",
    "unknown-boundary",
}


def validate_graph_verification(seed_input: Any, source_input: Any, context_input: Any) -> GraphVerification:
    """Execute the normative validateGraph(seed, source, context) operation."""
    context = _validate_context(context_input)
    seed_hash = _validate_seed_identity(seed_input, context["graphRoot"])
    seed = _validate_block_candidate_envelope(seed_input, "ALX_SCHEMA_INVALID", "seed")
    source = _validate_source(source_input)
    source_index = _index_source_blocks(source)

    issues: dict[tuple[str, str], dict[str, str]] = {}
    missing_parents: set[str] = set()
    external_parents: set[str] = set()
    examined: set[str] = set()
    scheduled: set[str] = {seed_hash}
    adjacency: dict[str, set[str]] = {}
    declared_external = {entry["hash"] for entry in context["externalParents"]}
    blocks_examined = 0
    edges_examined = 0
    limit_reached: dict[str, str] | None = None
    frontier: list[tuple[dict[str, Any], str, int]] = [(seed, seed_hash, 0)]

    def add_issue(code: str, block_hash: str) -> None:
        issues[(block_hash, code)] = {"code": code, "blockHash": block_hash}

    stopped = False
    while frontier and not stopped:
        frontier.sort(key=lambda item: item[1])
        next_frontier: dict[str, tuple[dict[str, Any], str, int]] = {}

        for block, block_hash, depth in frontier:
            max_blocks = (context.get("resourceLimits") or {}).get("maxBlocks")
            if max_blocks is not None and blocks_examined >= max_blocks:
                limit_reached = {"kind": "maxBlocks"}
                stopped = True
                break

            blocks_examined += 1
            examined.add(block_hash)
            adjacency[block_hash] = set()
            parents = _inspect_block(block, block_hash, add_issue)

            for parent_hash in parents:
                max_edges = (context.get("resourceLimits") or {}).get("maxEdges")
                if max_edges is not None and edges_examined >= max_edges:
                    limit_reached = {"kind": "maxEdges"}
                    stopped = True
                    break
                edges_examined += 1
                if parent_hash is None:
                    continue
                adjacency[block_hash].add(parent_hash)

                if depth >= context.get("maxDepth", MAX_SAFE_INTEGER):
                    continue
                if parent_hash in scheduled:
                    continue

                candidates = source_index.get(parent_hash, [])
                if len(candidates) > 1:
                    add_issue("ALX_DUPLICATE_BLOCK", parent_hash)
                    scheduled.add(parent_hash)
                    continue
                if not candidates:
                    if context["validationMode"] == "open-world" and parent_hash in declared_external:
                        external_parents.add(parent_hash)
                    else:
                        missing_parents.add(parent_hash)
                    scheduled.add(parent_hash)
                    continue

                scheduled.add(parent_hash)
                next_frontier[parent_hash] = (candidates[0], parent_hash, depth + 1)

            if stopped:
                break

        frontier = list(next_frontier.values())

    for component in _cyclic_components(adjacency, examined):
        add_issue("ALX_GRAPH_CYCLE", component[0])

    sorted_issues = [issues[key] for key in sorted(issues)]
    if sorted_issues:
        status = "invalid"
    elif limit_reached:
        status = "resource_limit_reached"
    elif missing_parents:
        status = "incomplete"
    else:
        status = "valid"

    result: GraphVerification = {
        "protocolVersion": "1",
        "checked": True,
        "status": status,
        "context": context,
        "blocksExamined": blocks_examined,
        "edgesExamined": edges_examined,
        "missingParents": sorted(missing_parents),
        "externalParents": sorted(external_parents),
        "issues": sorted_issues,
    }
    if limit_reached:
        result["limitReached"] = limit_reached
    return result


def _inspect_block(
    block: dict[str, Any],
    claimed_hash: str,
    add_issue: Callable[[str, str], None],
) -> list[str | None]:
    if block["protocolVersion"] != "1":
        add_issue("ALX_UNSUPPORTED_VERSION", claimed_hash)

    normalized_parents: list[str | None] = []
    valid_parents: list[str] = []
    all_parents_valid = True
    for parent in block["parentHashes"]:
        if not isinstance(parent, str):
            add_issue("ALX_INVALID_HASH", claimed_hash)
            normalized_parents.append(None)
            all_parents_valid = False
            continue
        try:
            normalized = normalize_hash(parent)
        except (TypeError, ValueError):
            add_issue("ALX_INVALID_HASH", claimed_hash)
            normalized_parents.append(None)
            all_parents_valid = False
            continue
        normalized_parents.append(normalized)
        valid_parents.append(normalized)

    distinct_parents = list(dict.fromkeys(valid_parents))
    sorted_parents = sorted(distinct_parents)
    if len(distinct_parents) != len(valid_parents):
        add_issue("ALX_DUPLICATE_PARENT", claimed_hash)
    if len(sorted_parents) > MAX_PARENTS:
        add_issue("ALX_TOO_MANY_PARENTS", claimed_hash)
    raw_parents_canonical = all(
        isinstance(parent, str) and parent == normalized_parents[index]
        for index, parent in enumerate(block["parentHashes"])
    )
    if all_parents_valid and (distinct_parents != sorted_parents or not raw_parents_canonical):
        add_issue("ALX_PARENT_HASHES_UNSORTED", claimed_hash)
    if claimed_hash in sorted_parents:
        add_issue("ALX_SELF_PARENT", claimed_hash)

    content_derivable = True
    try:
        computed_content_hash = derive_content_hash(block["content"])
        try:
            stored_content_hash = normalize_hash(block["contentHash"])
            if block["contentHash"] != stored_content_hash or stored_content_hash != computed_content_hash:
                add_issue("ALX_CONTENT_HASH_MISMATCH", claimed_hash)
        except (TypeError, ValueError):
            add_issue("ALX_INVALID_HASH", claimed_hash)
    except Exception:
        content_derivable = False
        add_issue("ALX_SCHEMA_INVALID", claimed_hash)

    if all_parents_valid and len(sorted_parents) <= MAX_PARENTS and content_derivable:
        try:
            computed_block_hash = derive_block_hash(block["content"], sorted_parents)
            if block["blockHash"] != claimed_hash or computed_block_hash != claimed_hash:
                add_issue("ALX_BLOCK_HASH_MISMATCH", claimed_hash)
        except Exception:
            add_issue("ALX_SCHEMA_INVALID", claimed_hash)

    return sorted(normalized_parents, key=lambda value: (value is not None, value or ""))


def _validate_context(value: Any) -> dict[str, Any]:
    if type(value) is not dict:
        _raise("ALX_INVALID_GRAPH", "context must be an object")
    _assert_allowed_properties(value, CONTEXT_FIELDS, "ALX_INVALID_GRAPH", "context")

    if value.get("validationMode") not in ("closed-world", "open-world"):
        _raise("ALX_INVALID_GRAPH", "validationMode must be closed-world or open-world")
    if value.get("protocolVersion") != "1":
        _raise("ALX_UNSUPPORTED_VERSION", "context protocolVersion must be 1")
    if not isinstance(value.get("graphRoot"), str):
        _raise("ALX_CONTEXT_ROOT_MISMATCH", "context graphRoot is required")
    try:
        graph_root = normalize_hash(value["graphRoot"])
    except (TypeError, ValueError):
        _raise("ALX_CONTEXT_ROOT_MISMATCH", "context graphRoot is invalid")
    if value["graphRoot"] != graph_root:
        _raise("ALX_INVALID_HASH", "context graphRoot must be canonical")

    external_entries = value.get("externalParents")
    if not isinstance(external_entries, list):
        _raise("ALX_INVALID_GRAPH", "context externalParents must be an array")
    if value["validationMode"] == "closed-world" and external_entries:
        _raise("ALX_EXTERNAL_PARENT_IN_CLOSED_WORLD", "closed-world context cannot declare external parents")

    external_hashes: set[str] = set()
    for boundary in external_entries:
        if type(boundary) is not dict:
            _raise("ALX_INVALID_GRAPH", "external parent boundary must be an object")
        _assert_allowed_properties(
            boundary,
            EXTERNAL_PARENT_FIELDS,
            "ALX_INVALID_GRAPH",
            "external parent boundary",
        )
        reason = boundary.get("reason")
        if (
            not isinstance(boundary.get("hash"), str)
            or not isinstance(reason, str)
            or reason not in EXTERNAL_REASONS
            or boundary.get("declaredBy") != "verification-context"
            or type(boundary.get("requiredForFullValidation")) is not bool
        ):
            _raise("ALX_INVALID_GRAPH", "external parent boundary is malformed")
        try:
            normalized = normalize_hash(boundary["hash"])
        except (TypeError, ValueError):
            _raise("ALX_INVALID_HASH", "external parent hash is invalid")
        if boundary["hash"] != normalized or normalized in external_hashes:
            _raise("ALX_INVALID_GRAPH", "external parent hashes must be canonical and unique")
        external_hashes.add(normalized)

    if "maxDepth" in value and not _is_safe_integer_at_least(value["maxDepth"], 0):
        _raise("ALX_INVALID_GRAPH", "maxDepth must be a non-negative safe integer")
    if "resourceLimits" in value:
        _validate_resource_limits(value["resourceLimits"])
    if "extensions" in value:
        extensions = value["extensions"]
        if (
            not isinstance(extensions, list)
            or any(not isinstance(item, str) or len(item) < 1 or len(item) > 128 for item in extensions)
            or len(set(extensions)) != len(extensions)
        ):
            _raise("ALX_INVALID_GRAPH", "extensions must be unique non-empty strings")
    return value


def _validate_resource_limits(value: Any) -> None:
    if type(value) is not dict:
        _raise("ALX_INVALID_GRAPH", "resourceLimits must be an object")
    _assert_allowed_properties(value, {"maxBlocks", "maxEdges"}, "ALX_INVALID_GRAPH", "resourceLimits")
    if not value:
        _raise("ALX_INVALID_GRAPH", "resourceLimits must not be empty")
    if "maxBlocks" in value and not _is_safe_integer_at_least(value["maxBlocks"], 1):
        _raise("ALX_INVALID_GRAPH", "maxBlocks must be a positive safe integer")
    if "maxEdges" in value and not _is_safe_integer_at_least(value["maxEdges"], 0):
        _raise("ALX_INVALID_GRAPH", "maxEdges must be a non-negative safe integer")


def _validate_seed_identity(value: Any, graph_root: str) -> str:
    if type(value) is not dict or not isinstance(value.get("blockHash"), str):
        _raise("ALX_CONTEXT_ROOT_MISMATCH", "seed blockHash is required")
    try:
        seed_hash = normalize_hash(value["blockHash"])
    except (TypeError, ValueError):
        _raise("ALX_CONTEXT_ROOT_MISMATCH", "seed blockHash is invalid")
    if seed_hash != graph_root:
        _raise("ALX_CONTEXT_ROOT_MISMATCH", "seed blockHash does not equal context graphRoot")
    return seed_hash


def _validate_source(value: Any) -> dict[str, Any]:
    if type(value) is not dict:
        _raise("ALX_INVALID_GRAPH", "source must be an object")
    _assert_allowed_properties(value, {"kind", "blocks"}, "ALX_INVALID_GRAPH", "source")
    if value.get("kind") != "finite" or not isinstance(value.get("blocks"), list):
        _raise("ALX_INVALID_GRAPH", "finite source requires a blocks array")
    return {
        "kind": "finite",
        "blocks": [
            _validate_block_candidate_envelope(candidate, "ALX_INVALID_GRAPH", f"source.blocks[{index}]")
            for index, candidate in enumerate(value["blocks"])
        ],
    }


def _validate_block_candidate_envelope(value: Any, code: str, label: str) -> dict[str, Any]:
    if type(value) is not dict:
        _raise(code, f"{label} must be a Block candidate object")
    _assert_allowed_properties(value, BLOCK_FIELDS, code, label)
    if (
        not isinstance(value.get("blockHash"), str)
        or not isinstance(value.get("contentHash"), str)
        or not isinstance(value.get("parentHashes"), list)
        or not isinstance(value.get("protocolVersion"), str)
        or "content" not in value
    ):
        _raise(code, f"{label} is not a complete Block candidate")
    return value


def _index_source_blocks(source: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = {}
    for candidate in source["blocks"]:
        try:
            normalized = normalize_hash(candidate["blockHash"])
        except (TypeError, ValueError):
            # Candidates outside the requested Graph are not validation findings.
            continue
        index.setdefault(normalized, []).append(candidate)
    return index


def _cyclic_components(adjacency: dict[str, set[str]], examined: set[str]) -> list[list[str]]:
    nodes = sorted(examined)
    neighbors = {
        node: sorted(parent for parent in adjacency.get(node, set()) if parent in examined)
        for node in nodes
    }
    visited: set[str] = set()
    finish_order: list[str] = []

    for start in nodes:
        if start in visited:
            continue
        stack: list[tuple[str, bool]] = [(start, False)]
        while stack:
            node, expanded = stack.pop()
            if expanded:
                finish_order.append(node)
                continue
            if node in visited:
                continue
            visited.add(node)
            stack.append((node, True))
            for adjacent in reversed(neighbors[node]):
                if adjacent not in visited:
                    stack.append((adjacent, False))

    reverse = {node: [] for node in nodes}
    for node, adjacent_nodes in neighbors.items():
        for parent in adjacent_nodes:
            reverse[parent].append(node)
    for adjacent_nodes in reverse.values():
        adjacent_nodes.sort()

    assigned: set[str] = set()
    components: list[list[str]] = []
    for start in reversed(finish_order):
        if start in assigned:
            continue
        component: list[str] = []
        stack = [start]
        assigned.add(start)
        while stack:
            node = stack.pop()
            component.append(node)
            for adjacent in reverse[node]:
                if adjacent not in assigned:
                    assigned.add(adjacent)
                    stack.append(adjacent)
        if len(component) > 1:
            components.append(sorted(component))
    return sorted(components, key=lambda component: component[0])


def _assert_allowed_properties(value: dict[str, Any], allowed: set[str], code: str, label: str) -> None:
    if any(key not in allowed for key in value):
        _raise(code, f"{label} contains an unsupported property")


def _is_safe_integer_at_least(value: Any, minimum: int) -> bool:
    return type(value) is int and minimum <= value <= MAX_SAFE_INTEGER


def _raise(code: str, message: str) -> None:
    raise ValueError(f"[{code}] {message}")
