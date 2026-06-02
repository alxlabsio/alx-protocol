"""ALX Protocol — Lineage validation."""

from typing import Any, Callable, Dict, List, Optional, Set


def validate_lineage(block_hash: str, parent_hashes: List[str], known_hashes: Optional[Set[str]] = None, context: Optional[dict] = None) -> dict:
    h = block_hash.strip().lower()
    raw = [p.strip().lower() for p in parent_hashes]
    unique = sorted(set(raw))
    seen, duplicates = set(), []
    for p in raw:
        if p in seen:
            duplicates.append(p)
        seen.add(p)
    self_ref = h in unique
    known = known_hashes or set()
    unresolved = sorted(p for p in unique if known and p not in known)
    mode = (context or {}).get("validationMode", "closed-world")
    declared_external = {p["hash"].strip().lower() for p in (context or {}).get("externalParents", [])}
    external = sorted(p for p in unresolved if mode == "open-world" and p in declared_external)
    missing = sorted(p for p in unresolved if p not in external)
    return {
        "ok": not duplicates and not missing and not self_ref,
        "blockHash": h,
        "parents": unique,
        "duplicates": sorted(set(duplicates)),
        "missing": missing,
        "external": external,
        "selfRef": self_ref,
        "cycle": self_ref,
    }


def validate_graph(graph: Dict[str, List[str]], context: Optional[dict] = None) -> dict:
    all_hashes = set(graph.keys())
    cycle_nodes = _detect_all_cycles(graph)
    issues, edges, roots, external_parents = [], 0, [], set()
    for h, parents in graph.items():
        edges += len(parents)
        if not parents:
            roots.append(h)
        result = validate_lineage(h, parents, all_hashes, context)
        external_parents.update(result["external"])
        if h in cycle_nodes:
            result["cycle"] = True
            result["ok"] = False
        if not result["ok"]:
            issues.append(result)
    return {
        "ok": len(issues) == 0,
        "blocks": len(graph),
        "edges": edges,
        "roots": sorted(roots),
        "mode": (context or {}).get("validationMode", "closed-world"),
        "externalParents": sorted(external_parents),
        "issues": issues,
    }


def build_graph(blocks: list) -> Dict[str, List[str]]:
    return {b["blockHash"].strip().lower(): sorted(p.strip().lower() for p in b.get("parentHashes", [])) for b in blocks}


def verify_graph(blocks: list[dict[str, Any]], compute_hash: Callable[[Any, List[str]], str]) -> dict:
    by_hash = {b["blockHash"].strip().lower(): b for b in blocks}
    broken, verified = [], 0
    for block in blocks:
        block_hash = block["blockHash"].strip().lower()
        expected = compute_hash(block.get("content"), block.get("parentHashes", []))
        if expected != block_hash:
            broken.append({"blockHash": block_hash, "reason": "hash_mismatch", "expected": expected})
            continue
        missing = [p.strip().lower() for p in block.get("parentHashes", []) if p.strip().lower() not in by_hash]
        if missing:
            broken.extend({"blockHash": block_hash, "reason": "parent_not_found", "parentHash": p} for p in missing)
            continue
        verified += 1
    return {"ok": len(broken) == 0, "verified": verified, "broken": broken}


def add_block_to_graph(block: dict[str, Any], graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
    graph[block["blockHash"].strip().lower()] = sorted(p.strip().lower() for p in block.get("parentHashes", []))
    return graph


def validate_incremental_block(block: dict[str, Any], existing_graph: Dict[str, List[str]], context: Optional[dict] = None) -> dict:
    h = block["blockHash"].strip().lower()
    parents = [p.strip().lower() for p in block.get("parentHashes", [])]
    unique = sorted(set(parents))
    seen, duplicates = set(), []
    for p in parents:
        if p in seen:
            duplicates.append(p)
        seen.add(p)
    self_ref = h in unique
    unresolved = sorted(p for p in unique if p not in existing_graph)
    mode = (context or {}).get("validationMode", "closed-world")
    declared_external = {p["hash"].strip().lower() for p in (context or {}).get("externalParents", [])}
    external = sorted(p for p in unresolved if mode == "open-world" and p in declared_external)
    missing = sorted(p for p in unresolved if p not in external)
    cycle = self_ref
    if not cycle:
        visited, stack = set(), [p for p in unique if p in existing_graph]
        while stack:
            current = stack.pop()
            if current == h:
                cycle = True
                break
            if current in visited:
                continue
            visited.add(current)
            stack.extend(existing_graph.get(current, []))
    return {"ok": not duplicates and not missing and not self_ref and not cycle, "blockHash": h, "parents": unique, "duplicates": sorted(set(duplicates)), "missing": missing, "external": external, "selfRef": self_ref, "cycle": cycle}


def _detect_all_cycles(graph: Dict[str, List[str]]) -> Set[str]:
    visiting, visited, in_cycle = set(), set(), set()
    def visit(node):
        if node in visited:
            return False
        if node in visiting:
            in_cycle.add(node)
            return True
        visiting.add(node)
        for parent in graph.get(node, []):
            if visit(parent):
                in_cycle.add(node)
        visiting.discard(node)
        visited.add(node)
        return False
    for node in graph:
        visit(node)
    return in_cycle
