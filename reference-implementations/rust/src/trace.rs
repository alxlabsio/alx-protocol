//! ALX Protocol — Attribution trace resolution.

use std::collections::{BTreeSet, HashMap, HashSet, VecDeque};
use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub struct TraceNode {
    pub hash: String,
    pub min_depth: usize,
    pub max_depth: usize,
    pub path_count: usize,
    pub parent_count: usize,
    pub child_count: usize,
}

#[derive(Debug, Clone)]
pub struct TraceEdge {
    pub from: String,
    pub to: String,
}

#[derive(Debug)]
pub struct AttributionTrace {
    pub root: String,
    pub validation_mode: String,
    pub complete: bool,
    pub nodes: Vec<TraceNode>,
    pub edges: Vec<TraceEdge>,
    pub leaves: Vec<String>,
    pub missing_parents: Vec<String>,
    pub external_parents: Vec<String>,
    pub max_depth: usize,
    pub cycle: bool,
}

#[derive(Debug)]
pub struct TraceVerification {
    pub ok: bool,
    pub issues: Vec<String>,
}

pub fn trace_attribution(root_hash: &str, graph: &HashMap<String, Vec<String>>, mode: Option<&str>, declared_external: Option<&HashSet<String>>) -> Result<AttributionTrace, String> {
    let root = root_hash.trim().to_lowercase();
    if root.is_empty() { return Err("rootHash is required".into()); }

    // Cycle pre-check
    let cycle_detected = {
        let mut visiting = HashSet::new();
        let mut visited = HashSet::new();
        fn check(node: &str, graph: &HashMap<String, Vec<String>>, visiting: &mut HashSet<String>, visited: &mut HashSet<String>) -> bool {
            if visited.contains(node) { return false; }
            if visiting.contains(node) { return true; }
            visiting.insert(node.to_string());
            for p in graph.get(node).unwrap_or(&vec![]) {
                if check(&p.trim().to_lowercase(), graph, visiting, visited) { return true; }
            }
            visiting.remove(node);
            visited.insert(node.to_string());
            false
        }
        check(&root, graph, &mut visiting, &mut visited)
    };

    // BFS discovery
    let mut node_data: HashMap<String, (usize, usize, usize)> = HashMap::new(); // min, max, parent_count
    let mut edge_set: BTreeSet<(String, String)> = BTreeSet::new();
    let mut child_counts: HashMap<String, usize> = HashMap::new();
    let mut global_max_depth = 0;
    let validation_mode = mode.unwrap_or("closed-world").to_string();
    let declared_external = declared_external.cloned().unwrap_or_default();
    let mut missing_parents = BTreeSet::new();
    let mut external_parents = BTreeSet::new();

    let mut queue = VecDeque::new();
    queue.push_back((root.clone(), 0));

    while let Some((h, depth)) = queue.pop_front() {
        if let Some(data) = node_data.get_mut(&h) {
            data.0 = data.0.min(depth);
            data.1 = data.1.max(depth);
            if depth > global_max_depth { global_max_depth = depth; }
            continue;
        }
        let parents: Vec<String> = graph.get(&h).unwrap_or(&vec![]).iter().map(|p| p.trim().to_lowercase()).collect();
        node_data.insert(h.clone(), (depth, depth, parents.len()));
        if depth > global_max_depth { global_max_depth = depth; }

        for p in &parents {
            let key = (h.clone(), p.clone());
            if !edge_set.contains(&key) {
                edge_set.insert(key);
                *child_counts.entry(p.clone()).or_insert(0) += 1;
            }
            if !graph.contains_key(p) {
                if validation_mode == "open-world" && declared_external.contains(p) {
                    external_parents.insert(p.clone());
                } else {
                    missing_parents.insert(p.clone());
                }
                continue;
            }
            queue.push_back((p.clone(), depth + 1));
        }
    }

    // Topological path count propagation. Edges flow from child -> parent,
    // so a parent is processed only after every reachable child contributes.
    let mut path_counts: HashMap<String, usize> = HashMap::new();
    path_counts.insert(root.clone(), 1);
    let mut min_depths: HashMap<String, usize> = HashMap::new();
    min_depths.insert(root.clone(), 0);
    let mut max_depths: HashMap<String, usize> = HashMap::new();
    max_depths.insert(root.clone(), 0);
    let mut in_degree: HashMap<String, usize> = node_data.keys().cloned().map(|h| (h, 0)).collect();
    for (_, parent) in &edge_set {
        *in_degree.entry(parent.clone()).or_insert(0) += 1;
    }
    let mut ready: Vec<String> = in_degree.iter()
        .filter_map(|(hash, degree)| if *degree == 0 { Some(hash.clone()) } else { None })
        .collect();
    ready.sort();
    let mut topo_queue: VecDeque<String> = VecDeque::from(ready);

    while let Some(h) = topo_queue.pop_front() {
        let my_paths = *path_counts.get(&h).unwrap_or(&0);
        for p in graph.get(&h).unwrap_or(&vec![]) {
            let p = p.trim().to_lowercase();
            if node_data.contains_key(&p) {
                *path_counts.entry(p.clone()).or_insert(0) += my_paths;
                let next_min = min_depths.get(&h).copied().unwrap_or(0) + 1;
                let next_max = max_depths.get(&h).copied().unwrap_or(0) + 1;
                let entry = min_depths.entry(p.clone()).or_insert(usize::MAX);
                *entry = (*entry).min(next_min);
                let entry = max_depths.entry(p.clone()).or_insert(0);
                *entry = (*entry).max(next_max);
                if let Some(remaining) = in_degree.get_mut(&p) {
                    *remaining -= 1;
                    if *remaining == 0 {
                        topo_queue.push_back(p);
                    }
                }
            }
        }
    }

    // Build output
    let mut nodes = vec![];
    let mut leaves = vec![];
    for (h, (_, _, pc)) in &node_data {
        nodes.push(TraceNode {
            hash: h.clone(),
            min_depth: *min_depths.get(h).unwrap_or(&0),
            max_depth: *max_depths.get(h).unwrap_or(&0),
            path_count: *path_counts.get(h).unwrap_or(&0),
            parent_count: *pc,
            child_count: *child_counts.get(h).unwrap_or(&0),
        });
        if *pc == 0 { leaves.push(h.clone()); }
    }
    nodes.sort_by(|a, b| a.min_depth.cmp(&b.min_depth).then(a.hash.cmp(&b.hash)));
    leaves.sort();
    let edges: Vec<TraceEdge> = edge_set.into_iter().map(|(f, t)| TraceEdge { from: f, to: t }).collect();

    let max_depth = max_depths.values().copied().max().unwrap_or(0);

    Ok(AttributionTrace {
        root,
        validation_mode,
        complete: missing_parents.is_empty() && external_parents.is_empty() && !cycle_detected,
        nodes,
        edges,
        leaves,
        missing_parents: missing_parents.into_iter().collect(),
        external_parents: external_parents.into_iter().collect(),
        max_depth,
        cycle: cycle_detected,
    })
}


pub fn verify_trace(trace: &Value, graph: &HashMap<String, Vec<String>>, mode: Option<&str>, declared_external: Option<&HashSet<String>>) -> Result<TraceVerification, String> {
    let root = trace.get("root").and_then(Value::as_str).ok_or("trace.root is required")?;
    let expected = trace_attribution(root, graph, mode, declared_external)?;
    let expected_nodes: Vec<Value> = expected.nodes.iter().map(|node| json!({
        "hash": node.hash,
        "minDepth": node.min_depth,
        "maxDepth": node.max_depth,
        "pathCount": node.path_count,
        "parentCount": node.parent_count,
        "childCount": node.child_count,
    })).collect();
    let expected_edges: Vec<Value> = expected.edges.iter().map(|edge| json!({
        "from": edge.from,
        "to": edge.to,
    })).collect();
    let expected_leaves: Vec<Value> = expected.leaves.iter().map(|leaf| Value::String(leaf.clone())).collect();
    let expected_missing: Vec<Value> = expected.missing_parents.iter().map(|item| Value::String(item.clone())).collect();
    let expected_external: Vec<Value> = expected.external_parents.iter().map(|item| Value::String(item.clone())).collect();
    let mut issues = vec![];
    if let Some(nodes) = trace.get("nodes").and_then(Value::as_array) {
        let mut seen = HashSet::new();
        for node in nodes {
            if let Some(hash) = node.get("hash").and_then(Value::as_str) {
                if !seen.insert(hash.to_string()) { issues.push("duplicate_nodes".into()); break; }
            }
        }
        if *nodes != expected_nodes { issues.push("nodes_mismatch".into()); }
    } else { issues.push("nodes_mismatch".into()); }
    if let Some(edges) = trace.get("edges").and_then(Value::as_array) {
        let mut seen = HashSet::new();
        for edge in edges {
            let key = format!("{}\0{}", edge.get("from").and_then(Value::as_str).unwrap_or(""), edge.get("to").and_then(Value::as_str).unwrap_or(""));
            if !seen.insert(key) { issues.push("duplicate_edges".into()); break; }
        }
        if *edges != expected_edges { issues.push("edges_mismatch".into()); }
    } else { issues.push("edges_mismatch".into()); }
    if let Some(leaves) = trace.get("leaves").and_then(Value::as_array) {
        let mut seen = HashSet::new();
        for leaf in leaves {
            if let Some(hash) = leaf.as_str() {
                if !seen.insert(hash.to_string()) { issues.push("duplicate_leaves".into()); break; }
            }
        }
        if *leaves != expected_leaves { issues.push("leaves_mismatch".into()); }
    } else { issues.push("leaves_mismatch".into()); }
    if trace.get("validationMode").and_then(Value::as_str) != Some(expected.validation_mode.as_str()) { issues.push("validation_mode_mismatch".into()); }
    if trace.get("complete").and_then(Value::as_bool) != Some(expected.complete) { issues.push("complete_mismatch".into()); }
    if trace.get("missingParents").and_then(Value::as_array) != Some(&expected_missing) { issues.push("missing_parents_mismatch".into()); }
    if trace.get("externalParents").and_then(Value::as_array) != Some(&expected_external) { issues.push("external_parents_mismatch".into()); }
    if trace.get("maxDepth").and_then(Value::as_u64) != Some(expected.max_depth as u64) { issues.push("max_depth_mismatch".into()); }
    if trace.get("cycle").and_then(Value::as_bool) != Some(expected.cycle) { issues.push("cycle_mismatch".into()); }
    Ok(TraceVerification { ok: issues.is_empty(), issues })
}
