//! ALX Protocol Conformance Adapter — Rust Reference Implementation
//!
//! Exposes the Rust reference implementation via the standard conformance
//! interface (stdin/stdout JSON protocol).
//!
//! Usage:
//!   echo '{"operation":"canonicalize","input":{"b":2,"a":1}}' | cargo run --bin conformance_adapter
//!
//! Reads one JSON operation per line from stdin, executes it,
//! writes one JSON result per line to stdout.

use std::io::{self, BufRead, Write};
use std::collections::HashMap;
use serde::Deserialize;
use serde_json::{json, Value};

use alx_protocol::{
    canonicalize,
    derive_block_hash,
    derive_content_hash,
    create_block,
    validate_block_detailed,
    validate_signed_block,
    validate_graph,
    validate_incremental_block,
    verify_graph,
    trace_attribution,
    verify_trace,
    Block,
    SignedBlock,
    BlockAttestation,
    Verifier,
    Ed25519Verifier,
    P256Verifier,
};
use alx_protocol::extensions::{build_merkle_tree, verify_merkle_proof};


struct FixtureVerifier;
impl Verifier for FixtureVerifier {
    fn verify(&self, data: &[u8], signature: &str, expected_signer: Option<&str>) -> Result<(bool, String), String> {
        let signer = signature.split(':').next().unwrap_or("").to_string();
        let ok = signature == format!("{}:{}", signer, hex::encode(data)) && expected_signer.map_or(true, |expected| expected == signer);
        Ok((ok, signer))
    }
    fn algorithm(&self) -> &str { "fixture" }
}

fn parse_attestation(value: &Value) -> Option<BlockAttestation> {
    Some(BlockAttestation {
        block_hash: value.get("blockHash")?.as_str()?.to_string(),
        attester: value.get("attester")?.as_str()?.to_string(),
        algorithm: value.get("algorithm")?.as_str()?.to_string(),
        timestamp: value.get("timestamp")?.as_u64()?,
        signature: value.get("signature")?.as_str()?.to_string(),
    })
}

fn parse_block(value: &Value) -> Option<Block> {
    Some(Block {
        block_hash: value.get("blockHash")?.as_str()?.to_string(),
        content_hash: value.get("contentHash")?.as_str()?.to_string(),
        parent_hashes: extract_string_array(value.get("parentHashes")),
        content: value.get("content").cloned().unwrap_or(Value::Null),
    })
}

fn parse_signed_block(value: &Value) -> Option<SignedBlock> {
    Some(SignedBlock {
        block: parse_block(value.get("block")?)?,
        attestation: value.get("attestation").and_then(parse_attestation),
        attestations: value.get("attestations").and_then(|v| v.as_array()).map(|items| items.iter().filter_map(parse_attestation).collect()).unwrap_or_default(),
    })
}
fn handle(op: &Value) -> Value {
    let operation = op.get("operation").and_then(|v| v.as_str()).unwrap_or("");
    let input = op.get("input").cloned().unwrap_or(Value::Null);

    match operation {
        "canonicalize" => {
            match canonicalize(&input) {
                Ok(result) => json!({"output": result}),
                Err(e) => json!({"error": e}),
            }
        }

        "canonicalizeGeneratedDepth" => {
            let mut value = input.get("leaf").cloned().unwrap_or(Value::Null);
            let depth = input.get("generatedDepth").and_then(|v| v.as_u64()).unwrap_or(0);
            for _ in 0..depth {
                value = json!({"nested": value});
            }
            match canonicalize(&value) {
                Ok(result) => json!({"output": result}),
                Err(e) => json!({"error": e}),
            }
        }

        "deriveBlockHash" => {
            let content = input.get("content").cloned().unwrap_or(Value::Null);
            let parents = extract_string_array(input.get("parentHashes"));
            match derive_block_hash(&content, &parents) {
                Ok(hash) => json!({"output": hash}),
                Err(e) => json!({"error": e}),
            }
        }

        "deriveContentHash" => {
            let content = input.get("content").cloned().unwrap_or(Value::Null);
            match derive_content_hash(&content) {
                Ok(hash) => json!({"output": hash}),
                Err(e) => json!({"error": e}),
            }
        }

        "createBlock" => {
            let content = input.get("content").cloned().unwrap_or(Value::Null);
            let parents = extract_string_array(input.get("parentHashes"));
            match create_block(content, &parents) {
                Ok(block) => json!({"output": {
                    "blockHash": block.block_hash,
                    "contentHash": block.content_hash,
                    "parentHashes": block.parent_hashes,
                    "content": block.content,
                }}),
                Err(e) => json!({"error": e}),
            }
        }

        "validateBlock" => {
            let Some(block) = parse_block(&input) else { return json!({"error": "invalid block"}); };
            match validate_block_detailed(&block) {
                Ok(result) => json!({"output": {
                    "ok": result.ok,
                    "expected": result.expected,
                    "actual": result.actual,
                    "expectedContentHash": result.expected_content_hash,
                    "actualContentHash": result.actual_content_hash,
                    "canonicalParents": result.canonical_parents,
                    "parentsCanonical": result.parents_canonical,
                    "selfRef": result.self_ref,
                }}),
                Err(e) => json!({"error": e}),
            }
        }

        "validateSignedBlockFixture" => {
            let Some(signed_block) = parse_signed_block(&input) else { return json!({"error": "invalid signed block"}); };
            match validate_signed_block(&signed_block, &[&FixtureVerifier]) {
                Ok(result) => json!({"output": {
                    "ok": result.ok,
                    "expected": result.expected,
                    "actual": result.actual,
                    "expectedContentHash": result.expected_content_hash,
                    "actualContentHash": result.actual_content_hash,
                    "canonicalParents": result.canonical_parents,
                    "parentsCanonical": result.parents_canonical,
                    "selfRef": result.self_ref,
                    "attestation": result.attestation.map(|v| json!({
                        "ok": v.ok,
                        "attester": v.attester,
                        "algorithm": v.algorithm,
                        "reason": v.reason,
                    })),
                    "attestations": result.attestations.iter().map(|v| json!({
                        "ok": v.ok,
                        "attester": v.attester,
                        "algorithm": v.algorithm,
                        "reason": v.reason,
                    })).collect::<Vec<Value>>(),
                }}),
                Err(e) => json!({"error": e}),
            }
        }

        "traceAttribution" => {
            let root_hash = input.get("rootHash").and_then(|v| v.as_str()).unwrap_or("");
            let graph_val = input.get("graph").cloned().unwrap_or(Value::Object(Default::default()));

            // Convert JSON object to HashMap<String, Vec<String>>
            let mut graph: HashMap<String, Vec<String>> = HashMap::new();
            if let Value::Object(obj) = graph_val {
                for (k, v) in obj {
                    graph.insert(k, extract_string_array(Some(&v)));
                }
            }

            let mode = input.get("context").and_then(|context| context.get("validationMode")).and_then(Value::as_str);
            let external_parents: std::collections::HashSet<String> = input.get("context")
                .and_then(|context| context.get("externalParents"))
                .and_then(Value::as_array)
                .map(|parents| parents.iter().filter_map(|parent| parent.get("hash").and_then(Value::as_str).map(|hash| hash.to_string())).collect())
                .unwrap_or_default();
            let trace = match trace_attribution(root_hash, &graph, mode, Some(&external_parents)) {
                Ok(t) => t,
                Err(e) => return json!({"error": e}),
            };

            let nodes: Vec<Value> = trace.nodes.iter().map(|n| json!({
                "hash": n.hash,
                "minDepth": n.min_depth,
                "maxDepth": n.max_depth,
                "pathCount": n.path_count,
                "parentCount": n.parent_count,
                "childCount": n.child_count,
            })).collect();

            let edges: Vec<Value> = trace.edges.iter().map(|e| json!({
                "from": e.from,
                "to": e.to,
            })).collect();

            json!({"output": {
                "root": trace.root,
                "validationMode": trace.validation_mode,
                "complete": trace.complete,
                "nodes": nodes,
                "edges": edges,
                "leaves": trace.leaves,
                "missingParents": trace.missing_parents,
                "externalParents": trace.external_parents,
                "maxDepth": trace.max_depth,
                "cycle": trace.cycle,
            }})
        }

        "validateGraph" => {
            let graph_val = input.get("graph").cloned().unwrap_or(Value::Object(Default::default()));
            let mut graph: HashMap<String, Vec<String>> = HashMap::new();
            if let Value::Object(obj) = graph_val {
                for (k, v) in obj {
                    graph.insert(k, extract_string_array(Some(&v)));
                }
            }
            let mode = input.get("context").and_then(|context| context.get("validationMode")).and_then(Value::as_str);
            let external_parents: std::collections::HashSet<String> = input.get("context")
                .and_then(|context| context.get("externalParents"))
                .and_then(Value::as_array)
                .map(|parents| parents.iter().filter_map(|parent| parent.get("hash").and_then(Value::as_str).map(|hash| hash.to_string())).collect())
                .unwrap_or_default();
            let result = validate_graph(&graph, mode, Some(&external_parents));
            json!({"output": {
                "ok": result.ok,
                "blocks": result.blocks,
                "edges": result.edges,
                "roots": result.roots,
                "mode": result.mode,
                "externalParents": result.external_parents,
                "issues": result.issues.iter().map(|issue| json!({
                    "ok": issue.ok,
                    "blockHash": issue.block_hash,
                    "parents": issue.parents,
                    "duplicates": issue.duplicates,
                    "missing": issue.missing,
                    "external": issue.external,
                    "selfRef": issue.self_ref,
                    "cycle": issue.cycle,
                })).collect::<Vec<Value>>(),
            }})
        }

        "validateIncrementalBlock" => {
            let block = input.get("block").cloned().unwrap_or(Value::Null);
            let block_hash = block.get("blockHash").and_then(|v| v.as_str()).unwrap_or("");
            let parent_hashes = extract_string_array(block.get("parentHashes"));
            let graph_val = input.get("existingGraph").cloned().unwrap_or(Value::Object(Default::default()));
            let mut graph: HashMap<String, Vec<String>> = HashMap::new();
            if let Value::Object(obj) = graph_val {
                for (k, v) in obj {
                    graph.insert(k, extract_string_array(Some(&v)));
                }
            }
            let mode = input.get("context").and_then(|context| context.get("validationMode")).and_then(Value::as_str);
            let external_parents: std::collections::HashSet<String> = input.get("context")
                .and_then(|context| context.get("externalParents"))
                .and_then(Value::as_array)
                .map(|parents| parents.iter().filter_map(|parent| parent.get("hash").and_then(Value::as_str).map(|hash| hash.to_string())).collect())
                .unwrap_or_default();
            let result = validate_incremental_block(block_hash, &parent_hashes, &graph, mode, Some(&external_parents));
            json!({"output": {
                "ok": result.ok,
                "blockHash": result.block_hash,
                "parents": result.parents,
                "duplicates": result.duplicates,
                "missing": result.missing,
                "external": result.external,
                "selfRef": result.self_ref,
                "cycle": result.cycle,
            }})
        }

        "validatePortableSignedBlock" => {
            let Some(signed_block) = parse_signed_block(&input) else { return json!({"error": "invalid signed block"}); };
            let algorithm = signed_block.attestation.as_ref().map(|att| att.algorithm.as_str()).unwrap_or("");
            let result = match algorithm {
                "ed25519" => validate_signed_block(&signed_block, &[&Ed25519Verifier]),
                "p256" => validate_signed_block(&signed_block, &[&P256Verifier]),
                _ => return json!({"error": format!("Unsupported portable signing algorithm: {}", algorithm)}),
            };
            match result {
                Ok(result) => json!({"output": {
                    "ok": result.ok,
                    "attestation": result.attestation.map(|v| json!({
                        "ok": v.ok,
                        "attester": v.attester,
                        "algorithm": v.algorithm,
                        "reason": v.reason,
                    })),
                    "attestations": result.attestations.iter().map(|v| json!({
                        "ok": v.ok,
                        "attester": v.attester,
                        "algorithm": v.algorithm,
                        "reason": v.reason,
                    })).collect::<Vec<Value>>(),
                }}),
                Err(e) => json!({"error": e}),
            }
        }

        "verifyTrace" => {
            let graph_val = input.get("graph").cloned().unwrap_or(Value::Object(Default::default()));
            let mut graph: HashMap<String, Vec<String>> = HashMap::new();
            if let Value::Object(obj) = graph_val {
                for (k, v) in obj {
                    graph.insert(k, extract_string_array(Some(&v)));
                }
            }
            let mode = input.get("context").and_then(|context| context.get("validationMode")).and_then(Value::as_str);
            let external_parents: std::collections::HashSet<String> = input.get("context")
                .and_then(|context| context.get("externalParents"))
                .and_then(Value::as_array)
                .map(|parents| parents.iter().filter_map(|parent| parent.get("hash").and_then(Value::as_str).map(|hash| hash.to_string())).collect())
                .unwrap_or_default();
            match verify_trace(input.get("trace").unwrap_or(&Value::Null), &graph, mode, Some(&external_parents)) {
                Ok(result) => json!({"output": { "ok": result.ok, "issues": result.issues }}),
                Err(e) => json!({"error": e}),
            }
        }

        "verifyGraph" => {
            let blocks_val = input.get("blocks").and_then(Value::as_array).cloned().unwrap_or_default();
            let parsed: Vec<(String, Value, Vec<String>)> = blocks_val.iter().map(|block| (
                block.get("blockHash").and_then(Value::as_str).unwrap_or("").to_string(),
                block.get("content").cloned().unwrap_or(Value::Null),
                extract_string_array(block.get("parentHashes")),
            )).collect();
            let refs: Vec<(&str, &Value, &[String])> = parsed.iter().map(|(hash, content, parents)| (hash.as_str(), content, parents.as_slice())).collect();
            match verify_graph(&refs, derive_block_hash) {
                Ok(result) => json!({"output": {
                    "ok": result.ok,
                    "verified": result.verified,
                    "broken": result.broken.iter().map(|issue| json!({
                        "blockHash": issue.block_hash,
                        "reason": issue.reason,
                        "expected": issue.expected,
                        "parentHash": issue.parent_hash,
                    })).collect::<Vec<Value>>(),
                }}),
                Err(e) => json!({"error": e}),
            }
        }

        "buildMerkleTree" => {
            let leaves = extract_string_array(input.get("leaves"));
            match build_merkle_tree(&leaves) {
                Ok(tree) => json!({"output": {
                    "root": tree.root,
                    "layers": tree.layers,
                }}),
                Err(e) => json!({"error": e}),
            }
        }

        "verifyMerkleProof" => {
            let root = input.get("root").and_then(|v| v.as_str()).unwrap_or("");
            let leaf = input.get("leaf").and_then(|v| v.as_str()).unwrap_or("");
            let proof = extract_string_array(input.get("proof"));
            json!({"output": verify_merkle_proof(root, leaf, &proof)})
        }

        _ => json!({"error": format!("Unknown operation: {}", operation)}),
    }
}

fn extract_string_array(val: Option<&Value>) -> Vec<String> {
    val.and_then(|v| v.as_array())
        .map(|arr| arr.iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect())
        .unwrap_or_default()
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut deserializer = serde_json::Deserializer::from_str(trimmed);
        deserializer.disable_recursion_limit();
        let result = match Value::deserialize(&mut deserializer) {
            Ok(op) => handle(&op),
            Err(e) => json!({"error": format!("Invalid JSON: {}", e)}),
        };

        let _ = writeln!(out, "{}", result);
        let _ = out.flush();
    }
}
