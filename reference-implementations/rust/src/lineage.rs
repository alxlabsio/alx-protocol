//! ALX Protocol — Lineage validation.

use serde_json::Value;
use std::collections::{BTreeSet, HashMap, HashSet};

use crate::block::normalize_hash;

#[derive(Debug)]
pub struct LineageResult {
    pub checked: bool,
    pub status: String,
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

pub fn validate_lineage(
    block_hash: &str,
    parent_hashes: &[String],
    known: Option<&HashSet<String>>,
    mode: Option<&str>,
    external_parents: Option<&HashSet<String>>,
) -> Result<LineageResult, String> {
    let h = normalize_hash(block_hash)?;
    let raw: Vec<String> = parent_hashes
        .iter()
        .map(|p| normalize_hash(p))
        .collect::<Result<Vec<_>, _>>()?;
    let normalized_known = known
        .map(|values| {
            values
                .iter()
                .map(|value| normalize_hash(value))
                .collect::<Result<HashSet<_>, _>>()
        })
        .transpose()?;
    let validation_mode = validate_mode(mode)?;
    let declared_external = normalize_external_parents(external_parents)?;
    Ok(validate_lineage_prepared(
        &h,
        &raw,
        normalized_known.as_ref(),
        validation_mode,
        &declared_external,
    ))
}

fn validate_lineage_prepared(
    block_hash: &str,
    raw: &[String],
    known: Option<&HashSet<String>>,
    validation_mode: &str,
    declared_external: &HashSet<String>,
) -> LineageResult {
    let unique: BTreeSet<String> = raw.iter().cloned().collect();
    let unique_vec: Vec<String> = unique.iter().cloned().collect();

    let mut seen = HashSet::new();
    let mut duplicates = BTreeSet::new();
    for p in raw {
        if !seen.insert(p.clone()) {
            duplicates.insert(p.clone());
        }
    }

    let self_ref = unique.contains(block_hash);
    let unresolved: Vec<String> = match known {
        Some(values) => unique_vec
            .iter()
            .filter(|p| !values.contains(*p))
            .cloned()
            .collect(),
        None => vec![],
    };
    let external: Vec<String> = if validation_mode == "open-world" {
        unresolved
            .iter()
            .filter(|p| declared_external.contains(*p))
            .cloned()
            .collect()
    } else {
        vec![]
    };
    let missing: Vec<String> = unresolved
        .into_iter()
        .filter(|p| !external.contains(p))
        .collect();

    LineageResult {
        checked: true,
        status: lineage_status(!duplicates.is_empty(), !missing.is_empty(), self_ref).into(),
        ok: duplicates.is_empty() && missing.is_empty() && !self_ref,
        block_hash: block_hash.to_string(),
        parents: unique_vec,
        duplicates: duplicates.into_iter().collect(),
        missing,
        external,
        self_ref,
        cycle: self_ref,
    }
}

pub fn validate_graph(
    graph: &HashMap<String, Vec<String>>,
    mode: Option<&str>,
    external_parents: Option<&HashSet<String>>,
) -> Result<GraphResult, String> {
    let prepared = prepare_graph(graph)?;
    let validation_mode = validate_mode(mode)?;
    let declared_external = normalize_external_parents(external_parents)?;
    let all: HashSet<String> = prepared.keys().cloned().collect();
    let cycle_nodes = detect_all_cycles(&prepared);
    let mut issues = vec![];
    let mut edges = 0;
    let mut roots = vec![];
    let mut external_seen = BTreeSet::new();

    for (h, parents) in &prepared {
        edges += parents.len();
        if parents.is_empty() {
            roots.push(h.clone());
        }
        let mut result =
            validate_lineage_prepared(h, parents, Some(&all), validation_mode, &declared_external);
        external_seen.extend(result.external.iter().cloned());
        if cycle_nodes.contains(h) {
            result.cycle = true;
            result.ok = false;
            result.status = "invalid".into();
        }
        if !result.ok {
            issues.push(result);
        }
    }
    roots.sort();
    issues.sort_by(|a, b| a.block_hash.cmp(&b.block_hash));

    Ok(GraphResult {
        ok: issues.is_empty(),
        blocks: prepared.len(),
        edges,
        roots,
        mode: validation_mode.into(),
        external_parents: external_seen.into_iter().collect(),
        issues,
    })
}

pub fn build_graph(blocks: &[(&str, &[String])]) -> Result<HashMap<String, Vec<String>>, String> {
    let mut g = HashMap::new();
    for (h, parents) in blocks {
        let hash = normalize_hash(h)?;
        if g.contains_key(&hash) {
            return Err(format!(
                "[ALX_DUPLICATE_BLOCK] duplicate Block candidate for {hash}"
            ));
        }
        let mut ps: Vec<String> = parents
            .iter()
            .map(|parent| normalize_hash(parent))
            .collect::<Result<Vec<_>, _>>()?;
        if ps.iter().collect::<HashSet<_>>().len() != ps.len() {
            return Err(
                "[ALX_DUPLICATE_PARENT] Graph entry contains duplicate parent hashes".into(),
            );
        }
        ps.sort();
        g.insert(hash, ps);
    }
    Ok(g)
}
pub fn verify_graph(
    blocks: &[(&str, &Value, &[String])],
    compute_hash: fn(&Value, &[String]) -> Result<String, String>,
) -> Result<VerifyResult, String> {
    let mut counts = HashMap::new();
    for (hash, _, _) in blocks {
        *counts.entry(hash.trim().to_lowercase()).or_insert(0usize) += 1;
    }
    let by_hash: HashSet<String> = counts.keys().cloned().collect();
    let duplicate_hashes: BTreeSet<String> = counts
        .iter()
        .filter(|(_, count)| **count > 1)
        .map(|(hash, _)| hash.clone())
        .collect();
    let mut verified = 0;
    let mut broken: Vec<VerifyIssue> = duplicate_hashes
        .iter()
        .map(|hash| VerifyIssue {
            block_hash: hash.clone(),
            reason: "duplicate_block".into(),
            expected: None,
            parent_hash: None,
        })
        .collect();

    for (block_hash, content, parents) in blocks {
        let hash = block_hash.trim().to_lowercase();
        if duplicate_hashes.contains(&hash) {
            continue;
        }
        let expected = compute_hash(content, parents)?;
        if expected != hash {
            broken.push(VerifyIssue {
                block_hash: hash,
                reason: "hash_mismatch".into(),
                expected: Some(expected),
                parent_hash: None,
            });
            continue;
        }
        let mut parents_broken = false;
        for parent in *parents {
            let normalized = parent.trim().to_lowercase();
            if !by_hash.contains(&normalized) {
                broken.push(VerifyIssue {
                    block_hash: hash.clone(),
                    reason: "parent_not_found".into(),
                    expected: None,
                    parent_hash: Some(normalized),
                });
                parents_broken = true;
            }
        }
        if !parents_broken {
            verified += 1;
        }
    }

    broken.sort_by(|left, right| {
        (&left.block_hash, &left.reason, &left.parent_hash).cmp(&(
            &right.block_hash,
            &right.reason,
            &right.parent_hash,
        ))
    });
    Ok(VerifyResult {
        ok: broken.is_empty(),
        verified,
        broken,
    })
}

pub fn add_block_to_graph<'a>(
    block_hash: &str,
    parent_hashes: &[String],
    graph: &'a mut HashMap<String, Vec<String>>,
) -> Result<&'a mut HashMap<String, Vec<String>>, String> {
    let block_hash = normalize_hash(block_hash)?;
    for existing in graph.keys() {
        if normalize_hash(existing)? == block_hash {
            return Err(format!(
                "[ALX_DUPLICATE_BLOCK] Graph already contains {block_hash}"
            ));
        }
    }
    let mut parents: Vec<String> = parent_hashes
        .iter()
        .map(|parent| normalize_hash(parent))
        .collect::<Result<Vec<_>, _>>()?;
    if parents.iter().collect::<HashSet<_>>().len() != parents.len() {
        return Err("[ALX_DUPLICATE_PARENT] Graph entry contains duplicate parent hashes".into());
    }
    parents.sort();
    graph.insert(block_hash, parents);
    Ok(graph)
}

pub fn validate_incremental_block(
    block_hash: &str,
    parent_hashes: &[String],
    existing_graph: &HashMap<String, Vec<String>>,
    mode: Option<&str>,
    external_parents: Option<&HashSet<String>>,
) -> Result<LineageResult, String> {
    let validation_mode = validate_mode(mode)?;
    let prepared_graph = prepare_graph(existing_graph)?;
    let h = normalize_hash(block_hash)?;
    let parents: Vec<String> = parent_hashes
        .iter()
        .map(|p| normalize_hash(p))
        .collect::<Result<Vec<_>, _>>()?;
    let unique: BTreeSet<String> = parents.iter().cloned().collect();
    let unique_vec: Vec<String> = unique.iter().cloned().collect();

    let mut seen = HashSet::new();
    let mut duplicates = BTreeSet::new();
    for parent in &parents {
        if !seen.insert(parent.clone()) {
            duplicates.insert(parent.clone());
        }
    }

    let self_ref = unique.contains(&h);
    let unresolved: Vec<String> = unique_vec
        .iter()
        .filter(|p| !prepared_graph.contains_key(*p))
        .cloned()
        .collect();
    let declared_external = normalize_external_parents(external_parents)?;
    let external: Vec<String> = if validation_mode == "open-world" {
        unresolved
            .iter()
            .filter(|p| declared_external.contains(*p))
            .cloned()
            .collect()
    } else {
        vec![]
    };
    let missing: Vec<String> = unresolved
        .into_iter()
        .filter(|p| !external.contains(p))
        .collect();
    let mut cycle = self_ref;

    if !cycle {
        let mut visited = HashSet::new();
        let mut stack: Vec<String> = unique_vec
            .iter()
            .filter(|p| prepared_graph.contains_key(*p))
            .cloned()
            .collect();
        while let Some(current) = stack.pop() {
            if current == h {
                cycle = true;
                break;
            }
            if !visited.insert(current.clone()) {
                continue;
            }
            if let Some(parents) = prepared_graph.get(&current) {
                stack.extend(parents.iter().cloned());
            }
        }
    }

    Ok(LineageResult {
        checked: true,
        status: lineage_status(
            !duplicates.is_empty(),
            !missing.is_empty(),
            self_ref || cycle,
        )
        .into(),
        ok: duplicates.is_empty() && missing.is_empty() && !self_ref && !cycle,
        block_hash: h,
        parents: unique_vec,
        duplicates: duplicates.into_iter().collect(),
        missing,
        external,
        self_ref,
        cycle,
    })
}

fn lineage_status(
    invalid_collection: bool,
    missing: bool,
    invalid_relationship: bool,
) -> &'static str {
    if invalid_collection || invalid_relationship {
        "invalid"
    } else if missing {
        "incomplete"
    } else {
        "valid"
    }
}

fn validate_mode(mode: Option<&str>) -> Result<&str, String> {
    let value = mode.unwrap_or("closed-world");
    if value != "closed-world" && value != "open-world" {
        return Err("[ALX_INVALID_GRAPH] validationMode must be closed-world or open-world".into());
    }
    Ok(value)
}

fn normalize_external_parents(
    external_parents: Option<&HashSet<String>>,
) -> Result<HashSet<String>, String> {
    external_parents
        .map(|values| {
            values
                .iter()
                .map(|value| normalize_hash(value))
                .collect::<Result<HashSet<_>, _>>()
        })
        .unwrap_or_else(|| Ok(HashSet::new()))
}

fn prepare_graph(
    graph: &HashMap<String, Vec<String>>,
) -> Result<HashMap<String, Vec<String>>, String> {
    let mut prepared = HashMap::new();
    for (raw_hash, raw_parents) in graph {
        let hash = normalize_hash(raw_hash)?;
        if prepared.contains_key(&hash) {
            return Err(format!(
                "[ALX_DUPLICATE_BLOCK] distinct Graph keys normalize to {hash}"
            ));
        }
        let mut parents = Vec::with_capacity(raw_parents.len());
        let mut seen = HashSet::new();
        for raw_parent in raw_parents {
            let parent = normalize_hash(raw_parent)?;
            if !seen.insert(parent.clone()) {
                return Err(
                    "[ALX_DUPLICATE_PARENT] Graph entry contains duplicate parent hashes".into(),
                );
            }
            parents.push(parent);
        }
        parents.sort();
        prepared.insert(hash, parents);
    }
    Ok(prepared)
}

fn detect_all_cycles(graph: &HashMap<String, Vec<String>>) -> HashSet<String> {
    let mut state: HashMap<String, u8> = HashMap::new();
    let mut in_cycle = HashSet::new();
    for node in graph.keys() {
        if state.get(node) == Some(&2) {
            continue;
        }
        let mut stack = vec![(node.clone(), 0usize)];
        let mut path = vec![node.clone()];
        state.insert(node.clone(), 1);
        while let Some((current, next_parent)) = stack.last_mut() {
            let parents = graph.get(current).map(Vec::as_slice).unwrap_or(&[]);
            if *next_parent >= parents.len() {
                state.insert(current.clone(), 2);
                stack.pop();
                path.pop();
                continue;
            }
            let parent = parents[*next_parent].clone();
            *next_parent += 1;
            if state.get(&parent) == Some(&1) {
                if let Some(cycle_start) = path.iter().position(|entry| entry == &parent) {
                    in_cycle.extend(path[cycle_start..].iter().cloned());
                }
            } else if state.get(&parent) != Some(&2) && graph.contains_key(&parent) {
                state.insert(parent.clone(), 1);
                stack.push((parent.clone(), 0));
                path.push(parent);
            }
        }
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
        let child = create_block(
            json!({"type": "child"}),
            std::slice::from_ref(&root.block_hash),
        )
        .unwrap();
        let mut graph = build_graph(&[(&root.block_hash, root.parent_hashes.as_slice())]).unwrap();
        assert!(
            validate_incremental_block(&child.block_hash, &child.parent_hashes, &graph, None, None)
                .unwrap()
                .ok
        );
        add_block_to_graph(&child.block_hash, &child.parent_hashes, &mut graph).unwrap();
        let verified = verify_graph(
            &[
                (
                    &root.block_hash,
                    &root.content,
                    root.parent_hashes.as_slice(),
                ),
                (
                    &child.block_hash,
                    &child.content,
                    child.parent_hashes.as_slice(),
                ),
            ],
            derive_block_hash,
        )
        .unwrap();
        assert!(verified.ok);
        assert_eq!(verified.verified, 2);
    }

    #[test]
    fn graph_helpers_reject_duplicates_and_match_full_final_validation() {
        let root = create_block(json!({"type": "root"}), &[]).unwrap();
        let child = create_block(
            json!({"type": "child"}),
            std::slice::from_ref(&root.block_hash),
        )
        .unwrap();
        assert!(build_graph(&[
            (&root.block_hash, root.parent_hashes.as_slice()),
            (&root.block_hash, root.parent_hashes.as_slice()),
        ])
        .unwrap_err()
        .contains("ALX_DUPLICATE_BLOCK"));

        let mut incremental_graph = HashMap::new();
        assert_eq!(
            validate_incremental_block(
                &child.block_hash,
                &child.parent_hashes,
                &incremental_graph,
                None,
                None,
            )
            .unwrap()
            .status,
            "incomplete"
        );
        add_block_to_graph(
            &root.block_hash,
            &root.parent_hashes,
            &mut incremental_graph,
        )
        .unwrap();
        assert_eq!(
            validate_incremental_block(
                &child.block_hash,
                &child.parent_hashes,
                &incremental_graph,
                None,
                None,
            )
            .unwrap()
            .status,
            "valid"
        );
        add_block_to_graph(
            &child.block_hash,
            &child.parent_hashes,
            &mut incremental_graph,
        )
        .unwrap();
        assert!(add_block_to_graph(
            &child.block_hash,
            &child.parent_hashes,
            &mut incremental_graph,
        )
        .unwrap_err()
        .contains("ALX_DUPLICATE_BLOCK"));

        let direct_graph = build_graph(&[
            (&child.block_hash, child.parent_hashes.as_slice()),
            (&root.block_hash, root.parent_hashes.as_slice()),
        ])
        .unwrap();
        let incremental_result = validate_graph(&incremental_graph, None, None).unwrap();
        let direct_result = validate_graph(&direct_graph, None, None).unwrap();
        assert_eq!(incremental_result.ok, direct_result.ok);
        assert_eq!(incremental_result.blocks, direct_result.blocks);
        assert_eq!(incremental_result.edges, direct_result.edges);
        assert_eq!(incremental_result.roots, direct_result.roots);
        assert_eq!(
            incremental_result.external_parents,
            direct_result.external_parents
        );
        assert_eq!(incremental_result.issues.len(), direct_result.issues.len());
    }
}
