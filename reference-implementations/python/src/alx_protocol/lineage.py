"""ALX Protocol — Lineage validation."""

from typing import Any, Callable, Dict, List, Optional, Set

from alx_protocol.block import normalize_hash
from alx_protocol.graph_validation import validate_graph_verification

_OMITTED = object()


def validate_lineage(block_hash: str, parent_hashes: List[str], known_hashes: Optional[Set[str]] = None, context: Optional[dict] = None) -> dict:
    h = normalize_hash(block_hash)
    if not isinstance(parent_hashes, list):
        raise ValueError("[ALX_INVALID_HASH] parentHashes must be an array")
    raw = [normalize_hash(p) for p in parent_hashes]
    known = None if known_hashes is None else {normalize_hash(value) for value in known_hashes}
    return _validate_prepared_lineage(
        h,
        raw,
        known,
        _validation_mode(context),
        _normalized_external_parents(context),
    )


def _validate_prepared_lineage(
    block_hash: str,
    raw: List[str],
    known: Optional[Set[str]],
    mode: str,
    declared_external: Set[str],
) -> dict:
    unique = sorted(set(raw))
    seen, duplicates = set(), []
    for p in raw:
        if p in seen:
            duplicates.append(p)
        seen.add(p)
    self_ref = block_hash in unique
    unresolved = [] if known is None else sorted(p for p in unique if p not in known)
    external = sorted(p for p in unresolved if mode == "open-world" and p in declared_external)
    missing = sorted(p for p in unresolved if p not in external)
    return {
        "checked": True,
        "status": _lineage_status(duplicates, missing, self_ref),
        "ok": not duplicates and not missing and not self_ref,
        "blockHash": block_hash,
        "parents": unique,
        "duplicates": sorted(set(duplicates)),
        "missing": missing,
        "external": external,
        "selfRef": self_ref,
        "cycle": self_ref,
    }


def validate_graph_structure(graph: Dict[str, List[str]], context: Optional[dict] = None) -> dict:
    prepared = _prepare_graph(graph)
    mode = _validation_mode(context)
    declared_external = _normalized_external_parents(context)
    all_hashes = set(prepared.keys())
    cycle_nodes = _detect_all_cycles(prepared)
    issues, edges, roots, external_parents = [], 0, [], set()
    for h, parents in prepared.items():
        edges += len(parents)
        if not parents:
            roots.append(h)
        result = _validate_prepared_lineage(h, parents, all_hashes, mode, declared_external)
        external_parents.update(result["external"])
        if h in cycle_nodes:
            result["cycle"] = True
            result["ok"] = False
            result["status"] = "invalid"
        if not result["ok"]:
            issues.append(result)
    issues.sort(key=lambda issue: issue["blockHash"])
    return {
        "ok": len(issues) == 0,
        "blocks": len(prepared),
        "edges": edges,
        "roots": sorted(roots),
        "mode": mode,
        "externalParents": sorted(external_parents),
        "issues": issues,
    }


def validate_graph(
    seed: Any = _OMITTED,
    source: Any = _OMITTED,
    context: Any = _OMITTED,
    **kwargs: Any,
) -> dict:
    """Validate a canonical Block Graph or use the legacy adjacency compatibility form."""
    legacy_graph_keyword = "graph" in kwargs
    if legacy_graph_keyword:
        if seed is not _OMITTED:
            raise TypeError("validate_graph received both seed and graph")
        seed = kwargs.pop("graph")
    if kwargs:
        unexpected = next(iter(kwargs))
        raise TypeError(f"validate_graph got an unexpected keyword argument '{unexpected}'")
    if seed is _OMITTED:
        raise TypeError("validate_graph requires a seed Block or adjacency Graph")
    if legacy_graph_keyword or source is _OMITTED:
        legacy_context = None if context is _OMITTED else context
        return validate_graph_structure(seed, legacy_context)
    if context is not _OMITTED:
        return validate_graph_verification(seed, source, context)
    return validate_graph_structure(seed, source)


def build_graph(blocks: list) -> Dict[str, List[str]]:
    entries: Dict[str, List[str]] = {}
    for block in blocks:
        block_hash = normalize_hash(block["blockHash"])
        if any(normalize_hash(existing) == block_hash for existing in entries):
            raise ValueError(f"[ALX_DUPLICATE_BLOCK] duplicate Block candidate for {block_hash}")
        entries[block_hash] = block.get("parentHashes", [])
    return _prepare_graph(entries)


def verify_graph(blocks: list[dict[str, Any]], compute_hash: Callable[[Any, List[str]], str]) -> dict:
    by_hash: dict[str, dict[str, Any]] = {}
    duplicate_hashes: set[str] = set()
    for block in blocks:
        block_hash = block["blockHash"].strip().lower()
        if block_hash in by_hash:
            duplicate_hashes.add(block_hash)
        else:
            by_hash[block_hash] = block
    broken = [
        {"blockHash": block_hash, "reason": "duplicate_block"}
        for block_hash in sorted(duplicate_hashes)
    ]
    verified = 0
    for block in blocks:
        block_hash = block["blockHash"].strip().lower()
        if block_hash in duplicate_hashes:
            continue
        expected = compute_hash(block.get("content"), block.get("parentHashes", []))
        if expected != block_hash:
            broken.append({"blockHash": block_hash, "reason": "hash_mismatch", "expected": expected})
            continue
        missing = [p.strip().lower() for p in block.get("parentHashes", []) if p.strip().lower() not in by_hash]
        if missing:
            broken.extend({"blockHash": block_hash, "reason": "parent_not_found", "parentHash": p} for p in missing)
            continue
        verified += 1
    broken.sort(key=lambda item: (item["blockHash"], item["reason"], item.get("parentHash", "")))
    return {"ok": len(broken) == 0, "verified": verified, "broken": broken}


def add_block_to_graph(block: dict[str, Any], graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
    block_hash = normalize_hash(block["blockHash"])
    if any(normalize_hash(existing) == block_hash for existing in graph):
        raise ValueError(f"[ALX_DUPLICATE_BLOCK] Graph already contains {block_hash}")
    parents = [normalize_hash(parent) for parent in block.get("parentHashes", [])]
    if len(set(parents)) != len(parents):
        raise ValueError("[ALX_DUPLICATE_PARENT] Graph entry contains duplicate parent hashes")
    graph[block_hash] = sorted(parents)
    return graph


def validate_incremental_block(block: dict[str, Any], existing_graph: Dict[str, List[str]], context: Optional[dict] = None) -> dict:
    mode = _validation_mode(context)
    prepared_graph = _prepare_graph(existing_graph)
    h = normalize_hash(block["blockHash"])
    raw_parents = block.get("parentHashes", [])
    if not isinstance(raw_parents, list):
        raise ValueError("[ALX_INVALID_HASH] parentHashes must be an array")
    parents = [normalize_hash(p) for p in raw_parents]
    unique = sorted(set(parents))
    seen, duplicates = set(), []
    for p in parents:
        if p in seen:
            duplicates.append(p)
        seen.add(p)
    self_ref = h in unique
    unresolved = sorted(p for p in unique if p not in prepared_graph)
    declared_external = _normalized_external_parents(context)
    external = sorted(p for p in unresolved if mode == "open-world" and p in declared_external)
    missing = sorted(p for p in unresolved if p not in external)
    cycle = self_ref
    if not cycle:
        visited, stack = set(), [p for p in unique if p in prepared_graph]
        while stack:
            current = stack.pop()
            if current == h:
                cycle = True
                break
            if current in visited:
                continue
            visited.add(current)
            stack.extend(prepared_graph.get(current, []))
    return {
        "checked": True,
        "status": _lineage_status(duplicates, missing, self_ref or cycle),
        "ok": not duplicates and not missing and not self_ref and not cycle,
        "blockHash": h,
        "parents": unique,
        "duplicates": sorted(set(duplicates)),
        "missing": missing,
        "external": external,
        "selfRef": self_ref,
        "cycle": cycle,
    }


def _lineage_status(duplicates: List[str], missing: List[str], invalid_relationship: bool) -> str:
    if duplicates or invalid_relationship:
        return "invalid"
    if missing:
        return "incomplete"
    return "valid"


def _validation_mode(context: Optional[dict]) -> str:
    if context is not None and not isinstance(context, dict):
        raise ValueError("[ALX_INVALID_GRAPH] validation context must be an object")
    mode = (context or {}).get("validationMode", "closed-world")
    if mode not in ("closed-world", "open-world"):
        raise ValueError("[ALX_INVALID_GRAPH] validationMode must be closed-world or open-world")
    return mode


def _normalized_external_parents(context: Optional[dict]) -> Set[str]:
    entries = (context or {}).get("externalParents", [])
    if not isinstance(entries, list):
        raise ValueError("[ALX_INVALID_GRAPH] externalParents must be an array")
    result = set()
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("hash"), str):
            raise ValueError("[ALX_INVALID_HASH] external parent hash must be a string")
        result.add(normalize_hash(entry["hash"]))
    return result


def _prepare_graph(graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
    if not isinstance(graph, dict):
        raise ValueError("[ALX_INVALID_GRAPH] graph must be an object")
    prepared: Dict[str, List[str]] = {}
    for raw_hash, raw_parents in graph.items():
        block_hash = normalize_hash(raw_hash)
        if block_hash in prepared:
            raise ValueError(f"[ALX_DUPLICATE_BLOCK] distinct Graph keys normalize to {block_hash}")
        if not isinstance(raw_parents, list):
            raise ValueError("[ALX_INVALID_HASH] Graph parentHashes must be an array")
        parents = [normalize_hash(parent) for parent in raw_parents]
        if len(set(parents)) != len(parents):
            raise ValueError("[ALX_DUPLICATE_PARENT] Graph entry contains duplicate parent hashes")
        prepared[block_hash] = sorted(parents)
    return prepared


def _detect_all_cycles(graph: Dict[str, List[str]]) -> Set[str]:
    state, in_cycle = {}, set()
    for start in graph:
        if state.get(start) == 2:
            continue
        stack, path = [[start, 0]], [start]
        state[start] = 1
        while stack:
            node, next_parent = stack[-1]
            parents = graph.get(node, [])
            if next_parent >= len(parents):
                state[node] = 2
                stack.pop()
                path.pop()
                continue
            parent = parents[next_parent].strip().lower()
            stack[-1][1] += 1
            if state.get(parent) == 1:
                in_cycle.update(path[path.index(parent):])
            elif state.get(parent) != 2 and parent in graph:
                state[parent] = 1
                stack.append([parent, 0])
                path.append(parent)
    return in_cycle
