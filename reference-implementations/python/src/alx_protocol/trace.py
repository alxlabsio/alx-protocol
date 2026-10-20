"""ALX Protocol — Attribution trace resolution."""

from collections import deque
from typing import Dict, List

HASH_LENGTH = 66


def _normalize_hash(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("[ALX_INVALID_HASH] graph hash must be a string")
    normalized = value.strip().lower()
    if len(normalized) != HASH_LENGTH or not normalized.startswith("0x") or any(char not in "0123456789abcdef" for char in normalized[2:]):
        raise ValueError("[ALX_INVALID_HASH] invalid graph hash")
    return normalized


def _prepare_graph(graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
    if not isinstance(graph, dict):
        raise ValueError("[ALX_INVALID_GRAPH] graph must be an object")
    prepared = {}
    for raw_hash, raw_parents in graph.items():
        block_hash = _normalize_hash(raw_hash)
        if block_hash in prepared:
            raise ValueError(f"[ALX_DUPLICATE_BLOCK] duplicate graph key after normalization: {block_hash}")
        if not isinstance(raw_parents, list):
            raise ValueError("[ALX_INVALID_GRAPH] graph parents must be an array")
        parents = [_normalize_hash(parent) for parent in raw_parents]
        if len(set(parents)) != len(parents):
            raise ValueError(f"[ALX_DUPLICATE_PARENT] duplicate parent for {block_hash}")
        prepared[block_hash] = parents
    return prepared


def trace_attribution(root_hash: str, graph: Dict[str, List[str]], context: dict | None = None) -> dict:
    """Return a complete computed AttributionTrace, not a Block or query page."""
    if not isinstance(root_hash, str) or not root_hash.strip():
        raise ValueError("[ALX_ROOT_HASH_REQUIRED] rootHash is required")
    root = _normalize_hash(root_hash)
    mode = (context or {}).get("validationMode", "closed-world")
    if mode not in ("closed-world", "open-world"):
        raise ValueError("[ALX_INVALID_GRAPH] validationMode must be closed-world or open-world")
    graph = _prepare_graph(graph)
    if root not in graph:
        raise ValueError("[ALX_GRAPH_ROOT_NOT_FOUND] rootHash is not present in the supplied Graph")

    # Cycle pre-check via iterative DFS
    cycle_detected = False
    state = {root: 1}
    stack = [[root, 0]]
    while stack and not cycle_detected:
        node, next_parent = stack[-1]
        parents = graph.get(node, [])
        if next_parent >= len(parents):
            state[node] = 2
            stack.pop()
            continue
        parent = parents[next_parent]
        stack[-1][1] += 1
        if state.get(parent) == 1:
            cycle_detected = True
        elif state.get(parent) != 2:
            state[parent] = 1
            stack.append([parent, 0])

    if cycle_detected:
        raise ValueError("[ALX_GRAPH_CYCLE] cannot construct an AttributionTrace from a cyclic Graph")

    # BFS discovery
    node_data = {}  # hash -> {min_depth, max_depth, parent_count}
    edge_set = set()
    edge_list = []
    # Trace-local reverse degree. Unreachable children elsewhere in graph are excluded.
    child_counts = {}
    global_max_depth = 0
    declared_external = {_normalize_hash(item["hash"]) for item in (context or {}).get("externalParents", [])}
    missing_parents = set()
    external_parents = set()

    queue = deque([(root, 0)])
    while queue:
        h, depth = queue.popleft()
        if h in node_data:
            node_data[h]["min_depth"] = min(node_data[h]["min_depth"], depth)
            node_data[h]["max_depth"] = max(node_data[h]["max_depth"], depth)
            if depth > global_max_depth:
                global_max_depth = depth
            continue

        parents = [p.strip().lower() for p in graph.get(h, [])]
        node_data[h] = {"min_depth": depth, "max_depth": depth, "parent_count": len(parents)}
        if depth > global_max_depth:
            global_max_depth = depth

        for p in parents:
            edge_key = f"{h}\0{p}"
            if edge_key not in edge_set:
                edge_set.add(edge_key)
                edge_list.append({"from": h, "to": p})
                child_counts[p] = child_counts.get(p, 0) + 1
            if p not in graph:
                if mode == "open-world" and p in declared_external:
                    external_parents.add(p)
                else:
                    missing_parents.add(p)
                continue
            queue.append((p, depth + 1))

    # Topological path count propagation.
    # Edges flow from child -> parent, so a parent can only be processed
    # after every reachable child has contributed its paths.
    path_counts = {root: 1}
    min_depths = {root: 0}
    max_depths = {root: 0}
    in_degree = {h: 0 for h in node_data}
    for edge in edge_list:
        if edge["to"] in node_data:
            in_degree[edge["to"]] += 1

    topo_queue = deque(sorted(h for h, degree in in_degree.items() if degree == 0))
    while topo_queue:
        h = topo_queue.popleft()
        my_paths = path_counts.get(h, 0)
        for p in [x.strip().lower() for x in graph.get(h, [])]:
            if p not in node_data:
                continue
            path_counts[p] = path_counts.get(p, 0) + my_paths
            min_depths[p] = min(min_depths.get(p, float("inf")), min_depths[h] + 1)
            max_depths[p] = max(max_depths.get(p, 0), max_depths[h] + 1)
            in_degree[p] -= 1
            if in_degree[p] == 0:
                topo_queue.append(p)

    # Build output
    nodes = []
    leaves = []
    for h, data in node_data.items():
        nodes.append({
            "hash": h,
            "minDepth": min_depths.get(h, 0),
            "maxDepth": max_depths.get(h, 0),
            "pathCount": str(path_counts.get(h, 0)),
            "parentCount": data["parent_count"],
            "childCount": child_counts.get(h, 0),
        })
        if data["parent_count"] == 0:
            leaves.append(h)

    nodes.sort(key=lambda n: (n["minDepth"], n["hash"]))
    edge_list.sort(key=lambda e: (e["from"], e["to"]))
    leaves.sort()

    return {
        "root": root,
        "validationMode": mode,
        "complete": not missing_parents and not external_parents,
        "nodes": nodes,
        "edges": edge_list,
        "leaves": leaves,
        "missingParents": sorted(missing_parents),
        "externalParents": sorted(external_parents),
        "maxDepth": max(max_depths.values(), default=0),
    }


def verify_trace(trace: dict, graph: Dict[str, List[str]], context: dict | None = None) -> dict:
    expected = trace_attribution(trace["root"], graph, context)
    issues = []
    top_level_fields = {"root", "validationMode", "complete", "nodes", "edges", "leaves", "missingParents", "externalParents", "maxDepth"}
    node_fields = {"hash", "minDepth", "maxDepth", "pathCount", "parentCount", "childCount"}
    edge_fields = {"from", "to"}
    if (set(trace) - top_level_fields
            or any(set(node) - node_fields for node in trace.get("nodes", []))
            or any(set(edge) - edge_fields for edge in trace.get("edges", []))):
        issues.append("unexpected_fields")
    node_hashes = [node["hash"] for node in trace.get("nodes", [])]
    if len(set(node_hashes)) != len(node_hashes):
        issues.append("duplicate_nodes")
    edge_keys = [(edge["from"], edge["to"]) for edge in trace.get("edges", [])]
    if len(set(edge_keys)) != len(edge_keys):
        issues.append("duplicate_edges")
    leaves = trace.get("leaves", [])
    if len(set(leaves)) != len(leaves):
        issues.append("duplicate_leaves")
    if trace.get("nodes") != expected["nodes"]:
        issues.append("nodes_mismatch")
    if trace.get("edges") != expected["edges"]:
        issues.append("edges_mismatch")
    if trace.get("leaves") != expected["leaves"]:
        issues.append("leaves_mismatch")
    if trace.get("validationMode") != expected["validationMode"]:
        issues.append("validation_mode_mismatch")
    if trace.get("complete") != expected["complete"]:
        issues.append("complete_mismatch")
    if trace.get("missingParents") != expected["missingParents"]:
        issues.append("missing_parents_mismatch")
    if trace.get("externalParents") != expected["externalParents"]:
        issues.append("external_parents_mismatch")
    if trace.get("maxDepth") != expected["maxDepth"]:
        issues.append("max_depth_mismatch")
    return {"ok": len(issues) == 0, "issues": issues}
