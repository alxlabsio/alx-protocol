//! Canonical ALX v1 Graph verification over a finite Block source.

use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet, HashSet};

use crate::block::{derive_block_hash, derive_content_hash, normalize_hash, MAX_PARENTS};

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
const BLOCK_FIELDS: &[&str] = &[
    "blockHash",
    "contentHash",
    "parentHashes",
    "content",
    "protocolVersion",
];
const CONTEXT_FIELDS: &[&str] = &[
    "protocolVersion",
    "validationMode",
    "graphRoot",
    "maxDepth",
    "resourceLimits",
    "extensions",
    "externalParents",
];
const EXTERNAL_PARENT_FIELDS: &[&str] =
    &["hash", "reason", "declaredBy", "requiredForFullValidation"];
const EXTERNAL_REASONS: &[&str] = &[
    "external-boundary",
    "private-boundary",
    "unavailable-boundary",
    "unknown-boundary",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphValidationStatus {
    Valid,
    Invalid,
    Incomplete,
    ResourceLimitReached,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct GraphValidationIssue {
    pub code: String,
    #[serde(rename = "blockHash")]
    pub block_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GraphLimitReached {
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GraphVerification {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    pub checked: bool,
    pub status: GraphValidationStatus,
    pub context: Value,
    #[serde(rename = "blocksExamined")]
    pub blocks_examined: u64,
    #[serde(rename = "edgesExamined")]
    pub edges_examined: u64,
    #[serde(rename = "missingParents")]
    pub missing_parents: Vec<String>,
    #[serde(rename = "externalParents")]
    pub external_parents: Vec<String>,
    pub issues: Vec<GraphValidationIssue>,
    #[serde(rename = "limitReached", skip_serializing_if = "Option::is_none")]
    pub limit_reached: Option<GraphLimitReached>,
}

#[derive(Clone)]
struct BlockCandidate {
    block_hash: String,
    content_hash: String,
    parent_hashes: Vec<Value>,
    content: Value,
    protocol_version: String,
}

struct ContextData {
    validation_mode: String,
    max_depth: Option<u64>,
    max_blocks: Option<u64>,
    max_edges: Option<u64>,
    declared_external: BTreeSet<String>,
}

struct TraversalItem {
    block: BlockCandidate,
    block_hash: String,
    depth: u64,
}

/// Execute the normative `validateGraph(seed, source, context)` operation.
pub fn validate_graph_verification(
    seed_input: &Value,
    source_input: &Value,
    context_input: &Value,
) -> Result<GraphVerification, String> {
    let (context, graph_root) = validate_context(context_input)?;
    let seed_hash = validate_seed_identity(seed_input, &graph_root)?;
    let seed = validate_block_candidate(seed_input, "ALX_SCHEMA_INVALID", "seed")?;
    let source = validate_source(source_input)?;
    let source_index = index_source_blocks(source);

    let mut issues: BTreeMap<(String, String), GraphValidationIssue> = BTreeMap::new();
    let mut missing_parents = BTreeSet::new();
    let mut external_parents = BTreeSet::new();
    let mut examined = BTreeSet::new();
    let mut scheduled = HashSet::from([seed_hash.clone()]);
    let mut adjacency: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut blocks_examined = 0_u64;
    let mut edges_examined = 0_u64;
    let mut limit_reached = None;
    let mut frontier = vec![TraversalItem {
        block: seed,
        block_hash: seed_hash,
        depth: 0,
    }];

    let mut stopped = false;
    while !frontier.is_empty() && !stopped {
        frontier.sort_by(|left, right| left.block_hash.cmp(&right.block_hash));
        let mut next = BTreeMap::new();

        for item in frontier {
            if context
                .max_blocks
                .is_some_and(|maximum| blocks_examined >= maximum)
            {
                limit_reached = Some(GraphLimitReached {
                    kind: "maxBlocks".into(),
                });
                stopped = true;
                break;
            }

            blocks_examined += 1;
            examined.insert(item.block_hash.clone());
            adjacency.entry(item.block_hash.clone()).or_default();
            let parents = inspect_block(&item.block, &item.block_hash, &mut issues);

            for parent_hash in parents {
                if context
                    .max_edges
                    .is_some_and(|maximum| edges_examined >= maximum)
                {
                    limit_reached = Some(GraphLimitReached {
                        kind: "maxEdges".into(),
                    });
                    stopped = true;
                    break;
                }
                edges_examined += 1;
                let Some(parent_hash) = parent_hash else {
                    continue;
                };
                adjacency
                    .entry(item.block_hash.clone())
                    .or_default()
                    .insert(parent_hash.clone());

                if context
                    .max_depth
                    .is_some_and(|maximum| item.depth >= maximum)
                    || scheduled.contains(&parent_hash)
                {
                    continue;
                }

                let candidates = source_index
                    .get(&parent_hash)
                    .map(Vec::as_slice)
                    .unwrap_or(&[]);
                if candidates.len() > 1 {
                    add_issue(&mut issues, "ALX_DUPLICATE_BLOCK", &parent_hash);
                    scheduled.insert(parent_hash);
                    continue;
                }
                if candidates.is_empty() {
                    if context.validation_mode == "open-world"
                        && context.declared_external.contains(&parent_hash)
                    {
                        external_parents.insert(parent_hash.clone());
                    } else {
                        missing_parents.insert(parent_hash.clone());
                    }
                    scheduled.insert(parent_hash);
                    continue;
                }

                scheduled.insert(parent_hash.clone());
                next.insert(
                    parent_hash.clone(),
                    TraversalItem {
                        block: candidates[0].clone(),
                        block_hash: parent_hash,
                        depth: item.depth + 1,
                    },
                );
            }

            if stopped {
                break;
            }
        }
        frontier = next.into_values().collect();
    }

    for component in cyclic_components(&adjacency, &examined) {
        add_issue(&mut issues, "ALX_GRAPH_CYCLE", &component[0]);
    }

    let issues: Vec<_> = issues.into_values().collect();
    let status = if !issues.is_empty() {
        GraphValidationStatus::Invalid
    } else if limit_reached.is_some() {
        GraphValidationStatus::ResourceLimitReached
    } else if !missing_parents.is_empty() {
        GraphValidationStatus::Incomplete
    } else {
        GraphValidationStatus::Valid
    };

    Ok(GraphVerification {
        protocol_version: "1".into(),
        checked: true,
        status,
        context: context_input.clone(),
        blocks_examined,
        edges_examined,
        missing_parents: missing_parents.into_iter().collect(),
        external_parents: external_parents.into_iter().collect(),
        issues,
        limit_reached,
    })
}

fn inspect_block(
    block: &BlockCandidate,
    claimed_hash: &str,
    issues: &mut BTreeMap<(String, String), GraphValidationIssue>,
) -> Vec<Option<String>> {
    if block.protocol_version != "1" {
        add_issue(issues, "ALX_UNSUPPORTED_VERSION", claimed_hash);
    }

    let mut normalized_parents = Vec::with_capacity(block.parent_hashes.len());
    let mut valid_parents = Vec::new();
    let mut all_parents_valid = true;
    let mut raw_parents_canonical = true;
    for parent in &block.parent_hashes {
        let Some(raw_parent) = parent.as_str() else {
            add_issue(issues, "ALX_INVALID_HASH", claimed_hash);
            normalized_parents.push(None);
            all_parents_valid = false;
            raw_parents_canonical = false;
            continue;
        };
        match normalize_hash(raw_parent) {
            Ok(normalized) => {
                if raw_parent != normalized {
                    raw_parents_canonical = false;
                }
                valid_parents.push(normalized.clone());
                normalized_parents.push(Some(normalized));
            }
            Err(_) => {
                add_issue(issues, "ALX_INVALID_HASH", claimed_hash);
                normalized_parents.push(None);
                all_parents_valid = false;
                raw_parents_canonical = false;
            }
        }
    }

    let mut seen = HashSet::new();
    let distinct_parents: Vec<String> = valid_parents
        .iter()
        .filter(|parent| seen.insert((*parent).clone()))
        .cloned()
        .collect();
    let mut sorted_parents = distinct_parents.clone();
    sorted_parents.sort();
    if distinct_parents.len() != valid_parents.len() {
        add_issue(issues, "ALX_DUPLICATE_PARENT", claimed_hash);
    }
    if sorted_parents.len() > MAX_PARENTS {
        add_issue(issues, "ALX_TOO_MANY_PARENTS", claimed_hash);
    }
    if all_parents_valid && (distinct_parents != sorted_parents || !raw_parents_canonical) {
        add_issue(issues, "ALX_PARENT_HASHES_UNSORTED", claimed_hash);
    }
    if sorted_parents.iter().any(|parent| parent == claimed_hash) {
        add_issue(issues, "ALX_SELF_PARENT", claimed_hash);
    }

    let mut content_derivable = true;
    match derive_content_hash(&block.content) {
        Ok(computed) => match normalize_hash(&block.content_hash) {
            Ok(stored) => {
                if block.content_hash != stored || stored != computed {
                    add_issue(issues, "ALX_CONTENT_HASH_MISMATCH", claimed_hash);
                }
            }
            Err(_) => add_issue(issues, "ALX_INVALID_HASH", claimed_hash),
        },
        Err(_) => {
            content_derivable = false;
            add_issue(issues, "ALX_SCHEMA_INVALID", claimed_hash);
        }
    }

    if all_parents_valid && sorted_parents.len() <= MAX_PARENTS && content_derivable {
        match derive_block_hash(&block.content, &sorted_parents) {
            Ok(computed) => {
                if block.block_hash != claimed_hash || computed != claimed_hash {
                    add_issue(issues, "ALX_BLOCK_HASH_MISMATCH", claimed_hash);
                }
            }
            Err(_) => add_issue(issues, "ALX_SCHEMA_INVALID", claimed_hash),
        }
    }

    normalized_parents.sort();
    normalized_parents
}

fn validate_context(value: &Value) -> Result<(ContextData, String), String> {
    let object = value
        .as_object()
        .ok_or_else(|| error("ALX_INVALID_GRAPH", "context must be an object"))?;
    assert_allowed(object, CONTEXT_FIELDS, "ALX_INVALID_GRAPH", "context")?;

    let validation_mode = object.get("validationMode").and_then(Value::as_str);
    if !matches!(validation_mode, Some("closed-world" | "open-world")) {
        return Err(error(
            "ALX_INVALID_GRAPH",
            "validationMode must be closed-world or open-world",
        ));
    }
    if object.get("protocolVersion").and_then(Value::as_str) != Some("1") {
        return Err(error(
            "ALX_UNSUPPORTED_VERSION",
            "context protocolVersion must be 1",
        ));
    }
    let graph_root_raw = object
        .get("graphRoot")
        .and_then(Value::as_str)
        .ok_or_else(|| error("ALX_CONTEXT_ROOT_MISMATCH", "context graphRoot is required"))?;
    let graph_root = normalize_hash(graph_root_raw)
        .map_err(|_| error("ALX_CONTEXT_ROOT_MISMATCH", "context graphRoot is invalid"))?;
    if graph_root_raw != graph_root {
        return Err(error(
            "ALX_INVALID_HASH",
            "context graphRoot must be canonical",
        ));
    }

    let external_entries = object
        .get("externalParents")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            error(
                "ALX_INVALID_GRAPH",
                "context externalParents must be an array",
            )
        })?;
    if validation_mode == Some("closed-world") && !external_entries.is_empty() {
        return Err(error(
            "ALX_EXTERNAL_PARENT_IN_CLOSED_WORLD",
            "closed-world context cannot declare external parents",
        ));
    }

    let mut declared_external = BTreeSet::new();
    for boundary in external_entries {
        let boundary = boundary.as_object().ok_or_else(|| {
            error(
                "ALX_INVALID_GRAPH",
                "external parent boundary must be an object",
            )
        })?;
        assert_allowed(
            boundary,
            EXTERNAL_PARENT_FIELDS,
            "ALX_INVALID_GRAPH",
            "external parent boundary",
        )?;
        let boundary_hash = boundary.get("hash").and_then(Value::as_str);
        let reason = boundary.get("reason").and_then(Value::as_str);
        if boundary_hash.is_none()
            || !reason.is_some_and(|reason| EXTERNAL_REASONS.contains(&reason))
            || boundary.get("declaredBy").and_then(Value::as_str) != Some("verification-context")
            || !boundary
                .get("requiredForFullValidation")
                .is_some_and(Value::is_boolean)
        {
            return Err(error(
                "ALX_INVALID_GRAPH",
                "external parent boundary is malformed",
            ));
        }
        let boundary_hash_raw = boundary_hash.unwrap();
        let normalized = normalize_hash(boundary_hash_raw)
            .map_err(|_| error("ALX_INVALID_HASH", "external parent hash is invalid"))?;
        if boundary_hash_raw != normalized || !declared_external.insert(normalized) {
            return Err(error(
                "ALX_INVALID_GRAPH",
                "external parent hashes must be canonical and unique",
            ));
        }
    }

    let max_depth = object
        .get("maxDepth")
        .map(|value| safe_integer(value, 0, "maxDepth must be a non-negative safe integer"))
        .transpose()?;

    let mut max_blocks = None;
    let mut max_edges = None;
    if let Some(limits) = object.get("resourceLimits") {
        let limits = limits
            .as_object()
            .ok_or_else(|| error("ALX_INVALID_GRAPH", "resourceLimits must be an object"))?;
        assert_allowed(
            limits,
            &["maxBlocks", "maxEdges"],
            "ALX_INVALID_GRAPH",
            "resourceLimits",
        )?;
        if limits.is_empty() {
            return Err(error(
                "ALX_INVALID_GRAPH",
                "resourceLimits must not be empty",
            ));
        }
        max_blocks = limits
            .get("maxBlocks")
            .map(|value| safe_integer(value, 1, "maxBlocks must be a positive safe integer"))
            .transpose()?;
        max_edges = limits
            .get("maxEdges")
            .map(|value| safe_integer(value, 0, "maxEdges must be a non-negative safe integer"))
            .transpose()?;
    }

    if let Some(extensions) = object.get("extensions") {
        let extensions = extensions.as_array().ok_or_else(|| {
            error(
                "ALX_INVALID_GRAPH",
                "extensions must be unique non-empty strings",
            )
        })?;
        let mut seen = HashSet::new();
        for extension in extensions {
            let Some(extension) = extension.as_str() else {
                return Err(error(
                    "ALX_INVALID_GRAPH",
                    "extensions must be unique non-empty strings",
                ));
            };
            let length = extension.chars().count();
            if !(1..=128).contains(&length) || !seen.insert(extension) {
                return Err(error(
                    "ALX_INVALID_GRAPH",
                    "extensions must be unique non-empty strings",
                ));
            }
        }
    }

    Ok((
        ContextData {
            validation_mode: validation_mode.unwrap().into(),
            max_depth,
            max_blocks,
            max_edges,
            declared_external,
        },
        graph_root,
    ))
}

fn validate_seed_identity(value: &Value, graph_root: &str) -> Result<String, String> {
    let raw_hash = value
        .as_object()
        .and_then(|object| object.get("blockHash"))
        .and_then(Value::as_str)
        .ok_or_else(|| error("ALX_CONTEXT_ROOT_MISMATCH", "seed blockHash is required"))?;
    let normalized = normalize_hash(raw_hash)
        .map_err(|_| error("ALX_CONTEXT_ROOT_MISMATCH", "seed blockHash is invalid"))?;
    if normalized != graph_root {
        return Err(error(
            "ALX_CONTEXT_ROOT_MISMATCH",
            "seed blockHash does not equal context graphRoot",
        ));
    }
    Ok(normalized)
}

fn validate_source(value: &Value) -> Result<Vec<BlockCandidate>, String> {
    let object = value
        .as_object()
        .ok_or_else(|| error("ALX_INVALID_GRAPH", "source must be an object"))?;
    assert_allowed(object, &["kind", "blocks"], "ALX_INVALID_GRAPH", "source")?;
    let blocks = object.get("blocks").and_then(Value::as_array);
    if object.get("kind").and_then(Value::as_str) != Some("finite") || blocks.is_none() {
        return Err(error(
            "ALX_INVALID_GRAPH",
            "finite source requires a blocks array",
        ));
    }
    blocks
        .unwrap()
        .iter()
        .enumerate()
        .map(|(index, candidate)| {
            validate_block_candidate(
                candidate,
                "ALX_INVALID_GRAPH",
                &format!("source.blocks[{index}]"),
            )
        })
        .collect()
}

fn validate_block_candidate(
    value: &Value,
    code: &str,
    label: &str,
) -> Result<BlockCandidate, String> {
    let object = value
        .as_object()
        .ok_or_else(|| error(code, &format!("{label} must be a Block candidate object")))?;
    assert_allowed(object, BLOCK_FIELDS, code, label)?;
    let Some(block_hash) = object.get("blockHash").and_then(Value::as_str) else {
        return Err(error(
            code,
            &format!("{label} is not a complete Block candidate"),
        ));
    };
    let Some(content_hash) = object.get("contentHash").and_then(Value::as_str) else {
        return Err(error(
            code,
            &format!("{label} is not a complete Block candidate"),
        ));
    };
    let Some(parent_hashes) = object.get("parentHashes").and_then(Value::as_array) else {
        return Err(error(
            code,
            &format!("{label} is not a complete Block candidate"),
        ));
    };
    let Some(protocol_version) = object.get("protocolVersion").and_then(Value::as_str) else {
        return Err(error(
            code,
            &format!("{label} is not a complete Block candidate"),
        ));
    };
    let Some(content) = object.get("content") else {
        return Err(error(
            code,
            &format!("{label} is not a complete Block candidate"),
        ));
    };
    Ok(BlockCandidate {
        block_hash: block_hash.into(),
        content_hash: content_hash.into(),
        parent_hashes: parent_hashes.clone(),
        content: content.clone(),
        protocol_version: protocol_version.into(),
    })
}

fn index_source_blocks(blocks: Vec<BlockCandidate>) -> BTreeMap<String, Vec<BlockCandidate>> {
    let mut index: BTreeMap<String, Vec<BlockCandidate>> = BTreeMap::new();
    for candidate in blocks {
        // Candidates outside the requested Graph are not validation findings.
        if let Ok(normalized) = normalize_hash(&candidate.block_hash) {
            index.entry(normalized).or_default().push(candidate);
        }
    }
    index
}

fn cyclic_components(
    adjacency: &BTreeMap<String, BTreeSet<String>>,
    examined: &BTreeSet<String>,
) -> Vec<Vec<String>> {
    let neighbors: BTreeMap<String, Vec<String>> = examined
        .iter()
        .map(|node| {
            let adjacent = adjacency
                .get(node)
                .into_iter()
                .flatten()
                .filter(|parent| examined.contains(*parent))
                .cloned()
                .collect();
            (node.clone(), adjacent)
        })
        .collect();
    let mut visited = HashSet::new();
    let mut finish_order = Vec::new();

    for start in examined {
        if visited.contains(start) {
            continue;
        }
        let mut stack = vec![(start.clone(), false)];
        while let Some((node, expanded)) = stack.pop() {
            if expanded {
                finish_order.push(node);
                continue;
            }
            if !visited.insert(node.clone()) {
                continue;
            }
            stack.push((node.clone(), true));
            if let Some(adjacent) = neighbors.get(&node) {
                for parent in adjacent.iter().rev() {
                    if !visited.contains(parent) {
                        stack.push((parent.clone(), false));
                    }
                }
            }
        }
    }

    let mut reverse: BTreeMap<String, Vec<String>> = examined
        .iter()
        .map(|node| (node.clone(), Vec::new()))
        .collect();
    for (node, adjacent) in &neighbors {
        for parent in adjacent {
            reverse.get_mut(parent).unwrap().push(node.clone());
        }
    }
    for adjacent in reverse.values_mut() {
        adjacent.sort();
    }

    let mut assigned = HashSet::new();
    let mut components = Vec::new();
    for start in finish_order.into_iter().rev() {
        if !assigned.insert(start.clone()) {
            continue;
        }
        let mut component = Vec::new();
        let mut stack = vec![start];
        while let Some(node) = stack.pop() {
            component.push(node.clone());
            if let Some(adjacent) = reverse.get(&node) {
                for next in adjacent {
                    if assigned.insert(next.clone()) {
                        stack.push(next.clone());
                    }
                }
            }
        }
        if component.len() > 1 {
            component.sort();
            components.push(component);
        }
    }
    components.sort_by(|left, right| left[0].cmp(&right[0]));
    components
}

fn add_issue(
    issues: &mut BTreeMap<(String, String), GraphValidationIssue>,
    code: &str,
    block_hash: &str,
) {
    issues.insert(
        (block_hash.into(), code.into()),
        GraphValidationIssue {
            code: code.into(),
            block_hash: block_hash.into(),
        },
    );
}

fn assert_allowed(
    object: &Map<String, Value>,
    allowed: &[&str],
    code: &str,
    label: &str,
) -> Result<(), String> {
    if object.keys().any(|key| !allowed.contains(&key.as_str())) {
        return Err(error(
            code,
            &format!("{label} contains an unsupported property"),
        ));
    }
    Ok(())
}

fn safe_integer(value: &Value, minimum: u64, message: &str) -> Result<u64, String> {
    value
        .as_u64()
        .filter(|number| *number >= minimum && *number <= MAX_SAFE_INTEGER)
        .ok_or_else(|| error("ALX_INVALID_GRAPH", message))
}

fn error(code: &str, message: &str) -> String {
    format!("[{code}] {message}")
}
