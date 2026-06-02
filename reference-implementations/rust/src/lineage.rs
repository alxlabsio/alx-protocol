//! ALX Protocol — Lineage validation.

use std::collections::{BTreeSet, HashMap, HashSet};
use serde_json::Value;

#[derive(Debug)]
pub struct LineageResult {
    pub ok: bool,
    pub block_hash: String,
    pub parents: Vec<String>,
    pub duplicates: Vec<String>,
    pub missing: Vec<String>,
    pub external: Vec<String>,
    pub self_ref: bool,
    pub cycle: bool,
}

#[derive(Debug)]
pub struct GraphResult {
    pub ok: bool,
    pub blocks: usize,
    pub edges: usize,
    pub roots: Vec<String>,
    pub mode: String,
    pub external_parents: Vec<String>,
    pub issues: Vec<LineageResult>,
}

#[derive(Debug)]
pub struct VerifyIssue {
    pub block_hash: String,
    pub reason: String,
    pub expected: Option<String>,
    pub parent_hash: Option<String>,
}

#[derive(Debug)]
pub struct VerifyResult {
    pub ok: bool,
    pub verified: usize,
    pub broken: Vec<VerifyIssue>,
}

pub fn validate_lineage(block_hash: &str, parent_hashes: &[String], known: Option<&HashSet<String>>, mode: Option<&str>, external_parents: Option<&HashSet<String>>) -> LineageResult {
    let h = block_hash.trim().to_lowercase();
    let raw: Vec<String> = parent_hashes.iter().map(|p| p.trim().to_lowercase()).collect();
    let unique: BTreeSet<String> = raw.iter().cloned().collect();
    let unique_vec: Vec<String> = unique.iter().cloned().collect();

    let mut seen = HashSet::new();
    let mut duplicates = BTreeSet::new();
    for p in &raw {
        if !seen.insert(p.clone()) { duplicates.insert(p.clone()); }
    }

    let self_ref = unique.contains(&h);
    let unresolved: Vec<String> = match known {
        Some(k) if !k.is_empty() => unique_vec.iter().filter(|p| !k.contains(*p)).cloned().collect(),
        _ => vec![],
    };
    let declared_external = external_parents.cloned().unwrap_or_default();
    let external: Vec<String> = if mode.unwrap_or("closed-world") == "open-world" {
        unresolved.iter().filter(|p| declared_external.contains(*p)).cloned().collect()
    } else { vec![] };
    let missing: Vec<String> = unresolved.into_iter().filter(|p| !external.contains(p)).collect();

    LineageResult {
        ok: duplicates.is_empty() && missing.is_empty() && !self_ref,
        block_hash: h,
        parents: unique_vec,
        duplicates: duplicates.into_iter().collect(),
        missing,
        external,
        self_ref,
        cycle: self_ref,
    }
}

pub fn validate_graph(graph: &HashMap<String, Vec<String>>, mode: Option<&str>, external_parents: Option<&HashSet<String>>) -> GraphResult {
    let all: HashSet<String> = graph.keys().cloned().collect();
    let cycle_nodes = detect_all_cycles(graph);
    let mut issues = vec![];
    let mut edges = 0;
    let mut roots = vec![];
    let mut external_seen = BTreeSet::new();

    for (h, parents) in graph {
        edges += parents.len();
        if parents.is_empty() { roots.push(h.clone()); }
        let mut result = validate_lineage(h, parents, Some(&all), mode, external_parents);
        external_seen.extend(result.external.iter().cloned());
        if cycle_nodes.contains(h) { result.cycle = true; result.ok = false; }
        if !result.ok { issues.push(result); }
    }
    roots.sort();

    GraphResult { ok: issues.is_empty(), blocks: graph.len(), edges, roots, mode: mode.unwrap_or("closed-world").into(), external_parents: external_seen.into_iter().collect(), issues }
}

pub fn build_graph(blocks: &[(&str, &[String])]) -> HashMap<String, Vec<String>> {
    let mut g = HashMap::new();
    for (h, parents) in blocks {
        let mut ps: Vec<String> = parents.iter().map(|p| p.trim().to_lowercase()).collect();
        ps.sort();
        g.insert(h.trim().to_lowercase(), ps);
    }
    g
}
pub fn verify_graph(
    blocks: &[(&str, &Value, &[String])],
    compute_hash: fn(&Value, &[String]) -> Result<String, String>,
) -> Result<VerifyResult, String> {
    let by_hash: HashSet<String> = blocks.iter().map(|(h, _, _)| h.trim().to_lowercase()).collect();
    let mut verified = 0;
    let mut broken = vec![];

    for (block_hash, content, parents) in blocks {
        let hash = block_hash.trim().to_lowercase();
        let expected = compute_hash(content, parents)?;
        if expected != hash {
            broken.push(VerifyIssue { block_hash: hash, reason: "hash_mismatch".into(), expected: Some(expected), parent_hash: None });
            continue;
        }
        let mut parents_broken = false;
        for parent in *parents {
            let normalized = parent.trim().to_lowercase();
            if !by_hash.contains(&normalized) {
                broken.push(VerifyIssue { block_hash: hash.clone(), reason: "parent_not_found".into(), expected: None, parent_hash: Some(normalized) });
                parents_broken = true;
            }
        }
        if !parents_broken { verified += 1; }
    }

    Ok(VerifyResult { ok: broken.is_empty(), verified, broken })
}

pub fn add_block_to_graph<'a>(block_hash: &str, parent_hashes: &[String], graph: &'a mut HashMap<String, Vec<String>>) -> &'a mut HashMap<String, Vec<String>> {
    let mut parents: Vec<String> = parent_hashes.iter().map(|p| p.trim().to_lowercase()).collect();
    parents.sort();
    graph.insert(block_hash.trim().to_lowercase(), parents);
    graph
}

pub fn validate_incremental_block(block_hash: &str, parent_hashes: &[String], existing_graph: &HashMap<String, Vec<String>>, mode: Option<&str>, external_parents: Option<&HashSet<String>>) -> LineageResult {
    let h = block_hash.trim().to_lowercase();
    let parents: Vec<String> = parent_hashes.iter().map(|p| p.trim().to_lowercase()).collect();
    let unique: BTreeSet<String> = parents.iter().cloned().collect();
    let unique_vec: Vec<String> = unique.iter().cloned().collect();

    let mut seen = HashSet::new();
    let mut duplicates = BTreeSet::new();
    for parent in &parents {
        if !seen.insert(parent.clone()) { duplicates.insert(parent.clone()); }
    }

    let self_ref = unique.contains(&h);
    let unresolved: Vec<String> = unique_vec.iter().filter(|p| !existing_graph.contains_key(*p)).cloned().collect();
    let declared_external = external_parents.cloned().unwrap_or_default();
    let external: Vec<String> = if mode.unwrap_or("closed-world") == "open-world" {
        unresolved.iter().filter(|p| declared_external.contains(*p)).cloned().collect()
    } else { vec![] };
    let missing: Vec<String> = unresolved.into_iter().filter(|p| !external.contains(p)).collect();
    let mut cycle = self_ref;

    if !cycle {
        let mut visited = HashSet::new();
        let mut stack: Vec<String> = unique_vec.iter().filter(|p| existing_graph.contains_key(*p)).cloned().collect();
        while let Some(current) = stack.pop() {
            if current == h {
                cycle = true;
                break;
            }
            if !visited.insert(current.clone()) { continue; }
            if let Some(parents) = existing_graph.get(&current) {
                stack.extend(parents.iter().cloned());
            }
        }
    }

    LineageResult {
        ok: duplicates.is_empty() && missing.is_empty() && !self_ref && !cycle,
        block_hash: h,
        parents: unique_vec,
        duplicates: duplicates.into_iter().collect(),
        missing,
        external,
        self_ref,
        cycle,
    }
}

fn detect_all_cycles(graph: &HashMap<String, Vec<String>>) -> HashSet<String> {
    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    let mut in_cycle = HashSet::new();

    fn visit(node: &str, graph: &HashMap<String, Vec<String>>, visiting: &mut HashSet<String>, visited: &mut HashSet<String>, in_cycle: &mut HashSet<String>) -> bool {
        if visited.contains(node) { return false; }
        if visiting.contains(node) { in_cycle.insert(node.to_string()); return true; }
        visiting.insert(node.to_string());
        for parent in graph.get(node).unwrap_or(&vec![]) {
            if visit(parent, graph, visiting, visited, in_cycle) { in_cycle.insert(node.to_string()); }
        }
        visiting.remove(node);
        visited.insert(node.to_string());
        false
    }

    for node in graph.keys() {
        visit(node, graph, &mut visiting, &mut visited, &mut in_cycle);
    }
    in_cycle
}



#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::{create_block, derive_block_hash};
    use serde_json::json;

    #[test]
    fn incremental_graph_helpers_validate_and_verify() {
        let root = create_block(json!({"type": "root"}), &[]).unwrap();
        let child = create_block(json!({"type": "child"}), &[root.block_hash.clone()]).unwrap();
        let mut graph = build_graph(&[(&root.block_hash, root.parent_hashes.as_slice())]);
        assert!(validate_incremental_block(&child.block_hash, &child.parent_hashes, &graph, None, None).ok);
        add_block_to_graph(&child.block_hash, &child.parent_hashes, &mut graph);
        let verified = verify_graph(
            &[
                (&root.block_hash, &root.content, root.parent_hashes.as_slice()),
                (&child.block_hash, &child.content, child.parent_hashes.as_slice()),
            ],
            derive_block_hash,
        ).unwrap();
        assert!(verified.ok);
        assert_eq!(verified.verified, 2);
    }
}

