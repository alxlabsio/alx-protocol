//! ALX Protocol CLI — Rust reference implementation.
//!
//! Usage:
//!   cargo run --bin alx -- validate protocol/graph.json
//!   cargo run --bin alx -- trace 0x5981da5f... --file protocol/graph.json

use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::process;

use alx_protocol::{
    decode_strict_json_bytes, trace_attribution, validate_block_detailed, validate_graph, Block,
};

fn bold(s: &str) -> String {
    format!("\x1b[1m{}\x1b[0m", s)
}
fn green(s: &str) -> String {
    format!("\x1b[32m{}\x1b[0m", s)
}
fn red(s: &str) -> String {
    format!("\x1b[31m{}\x1b[0m", s)
}
fn dim(s: &str) -> String {
    format!("\x1b[2m{}\x1b[0m", s)
}

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn parse_received_block(value: &Value) -> Result<Block, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "[ALX_SCHEMA_INVALID] Graph input must contain Block objects".to_string())?;
    const FIELDS: [&str; 5] = [
        "blockHash",
        "contentHash",
        "parentHashes",
        "content",
        "protocolVersion",
    ];
    if object.len() != FIELDS.len() || FIELDS.iter().any(|field| !object.contains_key(*field)) {
        return Err(
            "[ALX_SCHEMA_INVALID] received Block fields do not match the core Block schema".into(),
        );
    }
    let parent_hashes = object["parentHashes"]
        .as_array()
        .ok_or_else(|| "[ALX_SCHEMA_INVALID] parentHashes must be an array".to_string())?
        .iter()
        .map(|parent| {
            parent.as_str().map(str::to_string).ok_or_else(|| {
                "[ALX_SCHEMA_INVALID] every parent hash must be a string".to_string()
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let block = Block {
        block_hash: object["blockHash"]
            .as_str()
            .ok_or_else(|| "[ALX_SCHEMA_INVALID] blockHash must be a string".to_string())?
            .to_string(),
        content_hash: object["contentHash"]
            .as_str()
            .ok_or_else(|| "[ALX_SCHEMA_INVALID] contentHash must be a string".to_string())?
            .to_string(),
        parent_hashes,
        content: object["content"].clone(),
        protocol_version: object["protocolVersion"]
            .as_str()
            .ok_or_else(|| "[ALX_SCHEMA_INVALID] protocolVersion must be a string".to_string())?
            .to_string(),
    };
    let verification = validate_block_detailed(&block)?;
    if !verification.ok {
        return Err("[ALX_SCHEMA_INVALID] received Block is invalid or non-canonical".into());
    }
    Ok(block)
}

/// Parse a graph.json array without repairing received Blocks.
fn parse_graph_array(arr: &[Value]) -> Result<HashMap<String, Vec<String>>, String> {
    let mut graph = HashMap::new();
    for value in arr {
        let block = parse_received_block(value)?;
        if graph.contains_key(&block.block_hash) {
            return Err(format!(
                "[ALX_DUPLICATE_BLOCK] duplicate Block candidate for {}",
                block.block_hash
            ));
        }
        graph.insert(block.block_hash, block.parent_hashes);
    }
    Ok(graph)
}

fn load_strict_json(file: &str) -> Value {
    let bytes = fs::read(file).unwrap_or_else(|_| {
        eprintln!("{}  file not found: {}", red("✗"), file);
        process::exit(1);
    });
    decode_strict_json_bytes(&bytes).unwrap_or_else(|error| {
        eprintln!("{}  invalid JSON input: {}", red("✗"), error);
        process::exit(1);
    })
}

fn cmd_validate(file: &str) {
    let data = load_strict_json(file);

    let graph = match &data {
        Value::Array(arr) => parse_graph_array(arr),
        Value::Object(_) => {
            // Single block — wrap in array for uniform handling
            parse_graph_array(std::slice::from_ref(&data))
        }
        _ => {
            eprintln!(
                "{}  unrecognised file format (expected JSON array or object)",
                red("✗")
            );
            process::exit(1);
        }
    }
    .unwrap_or_else(|error| {
        eprintln!("{}  {}", red("✗"), error);
        process::exit(1);
    });

    let result = validate_graph(&graph, None, None).unwrap_or_else(|error| {
        eprintln!("{}  {}", red("✗"), error);
        process::exit(1);
    });
    if result.ok {
        println!(
            "  {}  {}",
            green("✓"),
            bold(&format!("{} blocks valid", result.blocks))
        );
        println!(
            "  {}  DAG structure valid ({} blocks, {} edges)",
            green("✓"),
            result.blocks,
            result.edges
        );
        println!(
            "  {}  {}",
            green("✓"),
            dim(&format!("alx-protocol Rust v{}", VERSION))
        );
    } else {
        println!(
            "  {}  validation failed ({} issue(s))",
            red("✗"),
            result.issues.len()
        );
        for issue in &result.issues {
            println!(
                "       {}...  duplicates={:?} missing={:?} self_ref={}",
                &issue.block_hash[..18.min(issue.block_hash.len())],
                issue.duplicates,
                issue.missing,
                issue.self_ref
            );
        }
        process::exit(1);
    }
}

fn cmd_trace(hash_prefix: &str, file: &str) {
    let data = load_strict_json(file);

    let arr = match &data {
        Value::Array(arr) => arr,
        _ => {
            eprintln!("{}  trace requires a graph file (JSON array)", red("✗"));
            process::exit(1);
        }
    };

    let graph = parse_graph_array(arr).unwrap_or_else(|error| {
        eprintln!("{}  {}", red("✗"), error);
        process::exit(1);
    });

    // Resolve hash prefix
    let prefix = hash_prefix.trim_start_matches("0x").to_lowercase();
    let matches: Vec<&String> = graph
        .keys()
        .filter(|h| h.trim_start_matches("0x").starts_with(&prefix) || h.starts_with(hash_prefix))
        .collect();

    if matches.is_empty() {
        eprintln!("{}  no block matching prefix: {}", red("✗"), hash_prefix);
        process::exit(1);
    }
    if matches.len() > 1 {
        eprintln!(
            "{}  ambiguous prefix matches {} blocks",
            red("✗"),
            matches.len()
        );
        process::exit(1);
    }

    let root_hash = matches[0].clone();
    let result = match trace_attribution(&root_hash, &graph, None, None) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("{}  trace failed: {}", red("✗"), e);
            process::exit(1);
        }
    };

    let short = &root_hash[..18.min(root_hash.len())];
    println!("  trace from  {}...", short);
    println!();

    for node in &result.nodes {
        let h = &node.hash[..18.min(node.hash.len())];
        let pc_str = if node.path_count != "1" {
            bold(&format!("pathCount={}", node.path_count))
        } else {
            String::new()
        };
        println!("  depth {}  {}...  {}", node.min_depth, h, pc_str);
    }

    println!();
    let has_multi = result.nodes.iter().any(|n| n.path_count != "1");
    if has_multi {
        println!(
            "{}",
            dim("  pathCount = independent causal paths from root to that ancestor")
        );
    }
    println!(
        "  {}  {}",
        green("✓"),
        dim(&format!("alx-protocol Rust v{}", VERSION))
    );
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() {
        println!("Usage: alx <validate|trace> [options]");
        process::exit(0);
    }

    match args[0].as_str() {
        "validate" => {
            if args.len() < 2 {
                eprintln!("Usage: alx validate <file>");
                process::exit(1);
            }
            cmd_validate(&args[1]);
        }
        "trace" => {
            let mut hash_prefix: Option<String> = None;
            let mut file_path: Option<String> = None;
            let mut i = 1;
            while i < args.len() {
                if (args[i] == "--file" || args[i] == "-f") && i + 1 < args.len() {
                    file_path = Some(args[i + 1].clone());
                    i += 2;
                } else {
                    if hash_prefix.is_none() {
                        hash_prefix = Some(args[i].clone());
                    }
                    i += 1;
                }
            }
            match (hash_prefix, file_path) {
                (Some(h), Some(f)) => cmd_trace(&h, &f),
                _ => {
                    eprintln!("Usage: alx trace <hash-prefix> --file <graph.json>");
                    process::exit(1);
                }
            }
        }
        cmd => {
            eprintln!("Unknown command: {}", cmd);
            eprintln!("Usage: alx <validate|trace> [options]");
            process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alx_protocol::create_block;
    use serde_json::json;

    fn value_for(block: &Block) -> Value {
        json!({
            "blockHash": block.block_hash,
            "contentHash": block.content_hash,
            "parentHashes": block.parent_hashes,
            "content": block.content,
            "protocolVersion": block.protocol_version,
        })
    }

    #[test]
    fn received_graph_boundary_rejects_unknown_fields_and_duplicate_blocks() {
        let block = create_block(json!({"type": "boundary"}), &[]).unwrap();
        let value = value_for(&block);
        assert!(parse_received_block(&value).is_ok());

        let mut unknown = value.clone();
        unknown["unexpected"] = Value::Bool(true);
        assert!(parse_received_block(&unknown)
            .unwrap_err()
            .contains("ALX_SCHEMA_INVALID"));

        assert!(parse_graph_array(&[value.clone(), value])
            .unwrap_err()
            .contains("ALX_DUPLICATE_BLOCK"));
    }
}
