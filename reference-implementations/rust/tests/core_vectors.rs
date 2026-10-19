use alx_protocol::{canonicalize, create_block, derive_block_hash, trace_attribution, validate_block_detailed, validate_graph, validate_incremental_block, verify_graph, verify_trace, Block};
use serde_json::Value;
use std::{collections::{HashMap, HashSet}, fs, path::PathBuf};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn load_json(path: &str) -> Value {
    let text = fs::read_to_string(repo_root().join(path)).unwrap();
    serde_json::from_str(&text).unwrap()
}

fn suite_path(id: &str) -> String {
    let manifest = load_json("protocol/suites.json");
    manifest["core"]["suites"]
        .as_array()
        .unwrap()
        .iter()
        .find(|suite| suite["id"] == id)
        .unwrap()["path"]
        .as_str()
        .unwrap()
        .to_string()
}

fn generated_parents(count: usize) -> Vec<String> {
    (0..count).map(|i| format!("0x{i:064x}")).collect()
}

#[test]
fn replays_canonicalization_vectors_from_manifest() {
    let suite = load_json(&suite_path("canonicalization"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        if id == "C4" || id == "C10" { continue; }
        assert_eq!(canonicalize(&vector["input"]).unwrap(), vector["expected"].as_str().unwrap(), "{id}");
    }
}

#[test]
fn replays_canonicalization_negative_vectors_from_manifest() {
    let suite = load_json(&suite_path("canonicalization-negative"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        let result = match id {
            "CN4" | "CN5" => canonicalize(&vector["input"]),
            "CN6" => {
                let mut value = serde_json::json!({"value": "leaf"});
                for _ in 0..129 { value = serde_json::json!({"nested": value}); }
                canonicalize(&value)
            }
            _ => continue,
        };
        assert!(result.is_err(), "{id}");
    }
}

#[test]
fn replays_canonicalization_depth_vectors_from_manifest() {
    let suite = load_json(&suite_path("canonicalization-depth"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        let mut value = Value::String(vector["input"]["leaf"].as_str().unwrap().to_string());
        for _ in 0..vector["input"]["generatedDepth"].as_u64().unwrap() {
            value = serde_json::json!({"nested": value});
        }
        let result = canonicalize(&value);
        if vector["expected"]["ok"].as_bool().unwrap() {
            assert!(result.is_ok(), "{id}");
        } else {
            assert!(result.is_err(), "{id}");
        }
    }
}

#[test]
fn replays_block_identity_vectors_from_manifest() {
    let suite = load_json(&suite_path("block-identity"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        if let Some(input) = vector.get("input") {
            let parents: Vec<String> = input["parentHashes"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
            let block = create_block(input["content"].clone(), &parents).unwrap();
            assert!(block.block_hash.starts_with("0x"), "{id}");
        } else {
            let a = &vector["input_a"];
            let b = &vector["input_b"];
            let parents_a: Vec<String> = a["parentHashes"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
            let parents_b: Vec<String> = b["parentHashes"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
            let block_a = create_block(a["content"].clone(), &parents_a).unwrap();
            let block_b = create_block(b["content"].clone(), &parents_b).unwrap();
            let assertions = vector["assertions"].as_array().unwrap();
            for assertion in assertions {
                let assertion = assertion.as_str().unwrap();
                if assertion.contains("blockHash ==") { assert_eq!(block_a.block_hash, block_b.block_hash, "{id}"); }
                if assertion.contains("blockHash !=") { assert_ne!(block_a.block_hash, block_b.block_hash, "{id}"); }
                if assertion.contains("contentHash ==") { assert_eq!(block_a.content_hash, block_b.content_hash, "{id}"); }
                if assertion.contains("contentHash !=") { assert_ne!(block_a.content_hash, block_b.content_hash, "{id}"); }
            }
        }
    }
}

#[test]
fn replays_parent_limit_vectors_from_manifest() {
    let suite = load_json(&suite_path("parent-limits"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        let parents = generated_parents(vector["input"]["generatedParentCount"].as_u64().unwrap() as usize);
        let result = create_block(vector["input"]["content"].clone(), &parents);
        if vector["expected"]["ok"].as_bool().unwrap() {
            assert_eq!(result.unwrap().parent_hashes.len(), vector["expected"]["normalizedParentCount"].as_u64().unwrap() as usize, "{id}");
        } else {
            assert!(result.is_err(), "{id}");
        }
    }
}

#[test]
fn replays_attribution_trace_vectors_from_manifest() {
    let suite = load_json(&suite_path("attribution-trace"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        let graph: HashMap<String, Vec<String>> = vector["graph"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(hash, parents)| {
                (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
            })
            .collect();
        let trace = trace_attribution(vector["root"].as_str().unwrap(), &graph, None, None).unwrap();
        let expected = &vector["expected"];
        if let Some(node_count) = expected.get("nodeCount").and_then(Value::as_u64) { assert_eq!(trace.nodes.len(), node_count as usize, "{id}"); }
        if let Some(edge_count) = expected.get("edgeCount").and_then(Value::as_u64) { assert_eq!(trace.edges.len(), edge_count as usize, "{id}"); }
        if let Some(max_depth) = expected.get("maxDepth").and_then(Value::as_u64) { assert_eq!(trace.max_depth, max_depth as usize, "{id}"); }
        if let Some(cycle) = expected.get("cycle").and_then(Value::as_bool) { assert_eq!(trace.cycle, cycle, "{id}"); }
        if let Some(nodes) = expected.get("nodes").and_then(Value::as_object) {
            for (hash, assertions) in nodes {
                let node = trace.nodes.iter().find(|node| node.hash == *hash).unwrap_or_else(|| panic!("{id}: missing node {hash}"));
                if let Some(path_count) = assertions.get("pathCount").and_then(Value::as_u64) { assert_eq!(node.path_count, path_count as usize, "{id}:{hash}:pathCount"); }
                if let Some(min_depth) = assertions.get("minDepth").and_then(Value::as_u64) { assert_eq!(node.min_depth, min_depth as usize, "{id}:{hash}:minDepth"); }
                if let Some(max_depth) = assertions.get("maxDepth").and_then(Value::as_u64) { assert_eq!(node.max_depth, max_depth as usize, "{id}:{hash}:maxDepth"); }
                if let Some(child_count) = assertions.get("childCount").and_then(Value::as_u64) { assert_eq!(node.child_count, child_count as usize, "{id}:{hash}:childCount"); }
            }
        }
    }
}

#[test]
fn replays_lineage_negative_cycle_vectors_from_manifest() {
    let suite = load_json(&suite_path("lineage-negative"));
    for vector in suite["vectors"].as_array().unwrap() {
        if vector.get("graph").is_none() || vector["expected"].get("hasCycle").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        let id = vector["id"].as_str().unwrap();
        let graph: HashMap<String, Vec<String>> = vector["graph"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(hash, parents)| {
                (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
            })
            .collect();
        let root = graph.keys().next().unwrap().clone();
        assert!(trace_attribution(&root, &graph, None, None).unwrap().cycle, "{id}");
    }
}

#[test]
fn replays_lineage_boundary_vectors_from_manifest() {
    let suite = load_json(&suite_path("lineage-boundaries"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        match vector["operation"].as_str().unwrap() {
            "validateGraph" => {
                let graph: HashMap<String, Vec<String>> = vector["input"]["graph"]
                    .as_object()
                    .unwrap()
                    .iter()
                    .map(|(hash, parents)| {
                        (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
                    })
                    .collect();
                let mode = vector["input"].get("context").and_then(|context| context.get("validationMode")).and_then(Value::as_str);
                let external_parents: std::collections::HashSet<String> = vector["input"].get("context")
                    .and_then(|context| context.get("externalParents"))
                    .and_then(Value::as_array)
                    .map(|parents| parents.iter().filter_map(|parent| parent.get("hash").and_then(Value::as_str).map(|hash| hash.to_string())).collect())
                    .unwrap_or_default();
                let result = validate_graph(&graph, mode, Some(&external_parents));
                assert_eq!(result.ok, vector["expected"]["ok"].as_bool().unwrap(), "{id}");
                assert_eq!(result.issues.len(), vector["expected"]["issueCount"].as_u64().unwrap() as usize, "{id}");
                if let Some(missing) = vector["expected"].get("missing") {
                    let expected_missing: Vec<String> = missing.as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
                    assert_eq!(result.issues[0].missing, expected_missing, "{id}");
                }
                if let Some(external) = vector["expected"].get("external") {
                    let expected_external: Vec<String> = external.as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
                    let actual_external = if result.issues.is_empty() { result.external_parents.clone() } else { result.issues[0].external.clone() };
                    assert_eq!(actual_external, expected_external, "{id}");
                }
            }
            "validateIncrementalBlock" => {
                let block = &vector["input"]["block"];
                let parent_hashes: Vec<String> = block["parentHashes"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
                let graph: HashMap<String, Vec<String>> = vector["input"]["existingGraph"]
                    .as_object()
                    .unwrap()
                    .iter()
                    .map(|(hash, parents)| {
                        (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
                    })
                    .collect();
                let result = validate_incremental_block(block["blockHash"].as_str().unwrap(), &parent_hashes, &graph, None, None);
                let expected_missing: Vec<String> = vector["expected"]["missing"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
                assert_eq!(result.ok, vector["expected"]["ok"].as_bool().unwrap(), "{id}");
                assert_eq!(result.missing, expected_missing, "{id}");
                assert_eq!(result.cycle, vector["expected"]["cycle"].as_bool().unwrap(), "{id}");
            }
            other => panic!("{id}: unsupported operation {other}"),
        }
    }
}

#[test]
fn replays_semantic_validity_vectors_from_manifest() {
    let suite = load_json(&suite_path("semantic-validity"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        match vector["operation"].as_str().unwrap() {
            "validateBlock" => {
                let input = &vector["input"];
                let parent_hashes: Vec<String> = input["parentHashes"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
                let block = Block {
                    block_hash: input["blockHash"].as_str().unwrap().to_string(),
                    content_hash: input["contentHash"].as_str().unwrap().to_string(),
                    parent_hashes,
                    content: input["content"].clone(),
                    protocol_version: Some("1".to_string()),
                };
                let result = validate_block_detailed(&block).unwrap();
                assert_eq!(result.ok, vector["expected"]["ok"].as_bool().unwrap(), "{id}");
                if let Some(expected) = vector["expected"].get("parentsCanonical").and_then(Value::as_bool) {
                    assert_eq!(result.parents_canonical, Some(expected), "{id}");
                }
                if let Some(expected) = vector["expected"].get("selfRef").and_then(Value::as_bool) {
                    assert_eq!(result.self_ref, Some(expected), "{id}");
                }
            }
            "validateGraph" => {
                let graph: HashMap<String, Vec<String>> = vector["input"]["graph"]
                    .as_object()
                    .unwrap()
                    .iter()
                    .map(|(hash, parents)| {
                        (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
                    })
                    .collect();
                let result = validate_graph(&graph, None, None);
                assert_eq!(result.ok, vector["expected"]["ok"].as_bool().unwrap(), "{id}");
                assert_eq!(result.issues.len(), vector["expected"]["issueCount"].as_u64().unwrap() as usize, "{id}");
                if let Some(missing) = vector["expected"].get("missing") {
                    let expected_missing: Vec<String> = missing.as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
                    assert_eq!(result.issues[0].missing, expected_missing, "{id}");
                }
            }
            other => panic!("{id}: unsupported operation {other}"),
        }
    }
}

#[test]
fn replays_semantic_integrity_vectors_from_manifest() {
    let suite = load_json(&suite_path("semantic-integrity"));
    for vector in suite["vectors"].as_array().unwrap() {
        let id = vector["id"].as_str().unwrap();
        match vector["operation"].as_str().unwrap() {
            "verifyTrace" => {
                let graph: HashMap<String, Vec<String>> = vector["input"]["graph"]
                    .as_object()
                    .unwrap()
                    .iter()
                    .map(|(hash, parents)| {
                        (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
                    })
                    .collect();
                let mode = vector["input"]["context"]["validationMode"].as_str();
                let external: HashSet<String> = vector["input"]["context"]["externalParents"]
                    .as_array()
                    .map(|parents| parents.iter().filter_map(|parent| parent["hash"].as_str().map(|hash| hash.to_string())).collect())
                    .unwrap_or_default();
                let result = verify_trace(&vector["input"]["trace"], &graph, mode, Some(&external)).unwrap();
                assert_eq!(result.ok, vector["expected"]["ok"].as_bool().unwrap(), "{id}");
                for issue in vector["expected"]["issues"].as_array().unwrap() {
                    assert!(result.issues.contains(&issue.as_str().unwrap().to_string()), "{id}");
                }
            }
            "traceAttribution" => {
                let graph: HashMap<String, Vec<String>> = vector["input"]["graph"]
                    .as_object()
                    .unwrap()
                    .iter()
                    .map(|(hash, parents)| {
                        (hash.clone(), parents.as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect())
                    })
                    .collect();
                let mode = vector["input"]["context"]["validationMode"].as_str();
                let external: HashSet<String> = vector["input"]["context"]["externalParents"]
                    .as_array()
                    .map(|parents| parents.iter().filter_map(|parent| parent["hash"].as_str().map(|hash| hash.to_string())).collect())
                    .unwrap_or_default();
                let result = trace_attribution(vector["input"]["rootHash"].as_str().unwrap(), &graph, mode, Some(&external)).unwrap();
                assert_eq!(result.validation_mode, vector["expected"]["validationMode"].as_str().unwrap(), "{id}");
                assert_eq!(result.complete, vector["expected"]["complete"].as_bool().unwrap(), "{id}");
                assert_eq!(result.missing_parents, vector["expected"]["missingParents"].as_array().unwrap().iter().map(|value| value.as_str().unwrap().to_string()).collect::<Vec<_>>(), "{id}");
                assert_eq!(result.external_parents, vector["expected"]["externalParents"].as_array().unwrap().iter().map(|value| value.as_str().unwrap().to_string()).collect::<Vec<_>>(), "{id}");
            }
            "verifyGraph" => {
                let owned: Vec<(String, Value, Vec<String>)> = vector["input"]["blocks"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|block| (
                        block["blockHash"].as_str().unwrap().to_string(),
                        block["content"].clone(),
                        block["parentHashes"].as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect(),
                    ))
                    .collect();
                let refs: Vec<(&str, &Value, &[String])> = owned.iter().map(|(hash, content, parents)| (hash.as_str(), content, parents.as_slice())).collect();
                let result = verify_graph(&refs, derive_block_hash).unwrap();
                assert_eq!(result.ok, vector["expected"]["ok"].as_bool().unwrap(), "{id}");
                assert!(result.broken.iter().any(|item| item.reason == vector["expected"]["brokenReason"].as_str().unwrap()), "{id}");
            }
            other => panic!("{id}: unsupported operation {other}"),
        }
    }
}
