//! ALX Protocol CLI — Rust reference implementation.
//!
//! Usage:
//!   cargo run --bin alx -- validate protocol/graph.json
//!   cargo run --bin alx -- trace 0x5981da5f... --file protocol/graph.json

use std::collections::HashMap;
use std::fs;
use std::process;
use serde_json::Value;

use alx_protocol::{validate_graph, trace_attribution};

fn bold(s: &str)  -> String { format!("\x1b[1m{}\x1b[0m", s) }
fn green(s: &str) -> String { format!("\x1b[32m{}\x1b[0m", s) }
fn red(s: &str)   -> String { format!("\x1b[31m{}\x1b[0m", s) }
fn dim(s: &str)   -> String { format!("\x1b[2m{}\x1b[0m", s) }

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Parse a graph.json array into HashMap<String, Vec<String>>.
fn parse_graph_array(arr: &[Value]) -> HashMap<String, Vec<String>> {
    let mut graph = HashMap::new();
    for block in arr {
        if let Some(bh) = block.get("blockHash").and_then(|v| v.as_str()) {
            let bh = bh.trim().to_lowercase();
            let parents: Vec<String> = block
                .get("parentHashes")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    let mut ps: Vec<String> = arr
                        .iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.trim().to_lowercase())
                        .collect();
                    ps.sort();
                    ps
                })
                .unwrap_or_default();
            graph.insert(bh, parents);
        }
    }
    graph
}

fn cmd_validate(file: &str) {
    let text = fs::read_to_string(file).unwrap_or_else(|_| {
        eprintln!("{}  file not found: {}", red("✗"), file);
        process::exit(1);
    });

    let data: Value = serde_json::from_str(&text).unwrap_or_else(|e| {
        eprintln!("{}  invalid JSON: {}", red("✗"), e);
        process::exit(1);
    });

    let graph = match &data {
        Value::Array(arr) => parse_graph_array(arr),
        Value::Object(_) => {
            // Single block — wrap in array for uniform handling
            parse_graph_array(&[data.clone()])
        }
        _ => {
            eprintln!("{}  unrecognised file format (expected JSON array or object)", red("✗"));
            process::exit(1);
        }
    };

    let result = validate_graph(&graph, None, None);
    if result.ok {
        println!("  {}  {}", green("✓"), bold(&format!("{} blocks valid", result.blocks)));
        println!("  {}  DAG structure valid ({} blocks, {} edges)",
            green("✓"), result.blocks, result.edges);
        println!("  {}  {}", green("✓"), dim(&format!("alx-protocol Rust v{}", VERSION)));
    } else {
        println!("  {}  validation failed ({} issue(s))", red("✗"), result.issues.len());
        for issue in &result.issues {
            println!("       {}...  duplicates={:?} missing={:?} self_ref={}",
                &issue.block_hash[..18.min(issue.block_hash.len())],
                issue.duplicates,
                issue.missing,
                issue.self_ref);
        }
        process::exit(1);
    }
}

fn cmd_trace(hash_prefix: &str, file: &str) {
    let text = fs::read_to_string(file).unwrap_or_else(|_| {
        eprintln!("{}  file not found: {}", red("✗"), file);
        process::exit(1);
    });

    let data: Value = serde_json::from_str(&text).unwrap_or_else(|e| {
        eprintln!("{}  invalid JSON: {}", red("✗"), e);
        process::exit(1);
    });

    let arr = match &data {
        Value::Array(arr) => arr,
        _ => {
            eprintln!("{}  trace requires a graph file (JSON array)", red("✗"));
            process::exit(1);
        }
    };

    let graph = parse_graph_array(arr);

    // Resolve hash prefix
    let prefix = hash_prefix.trim_start_matches("0x").to_lowercase();
    let matches: Vec<&String> = graph
        .keys()
        .filter(|h| h.trim_start_matches("0x").starts_with(&prefix)
                  || h.starts_with(hash_prefix))
        .collect();

    if matches.is_empty() {
        eprintln!("{}  no block matching prefix: {}", red("✗"), hash_prefix);
        process::exit(1);
    }
    if matches.len() > 1 {
        eprintln!("{}  ambiguous prefix matches {} blocks", red("✗"), matches.len());
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
        let pc_str = if node.path_count > 1 {
            bold(&format!("pathCount={}", node.path_count))
        } else {
            String::new()
        };
        println!("  depth {}  {}...  {}", node.min_depth, h, pc_str);
    }

    println!();
    let has_multi = result.nodes.iter().any(|n| n.path_count > 1);
    if has_multi {
        println!("{}", dim("  pathCount = independent causal paths from root to that ancestor"));
    }
    println!("  {}  {}", green("✓"), dim(&format!("alx-protocol Rust v{}", VERSION)));
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
