//! Verification receipt types and construction for ALX Protocol.
//!
//! A verification receipt records the result of verifying a Block graph at a point in time.
//! The receipt is not part of Block identity and does not change blockHash or contentHash.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::{SystemTime, UNIX_EPOCH};

static HASH_PATTERN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^0x[a-f0-9]{64}$").unwrap());

fn hash_pattern() -> &'static Regex {
    &HASH_PATTERN
}

/// Verifier identity recorded in a receipt.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerifierInfo {
    pub name: String,
    pub version: String,
}

/// An error or warning entry in a receipt.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReceiptError {
    pub code: String,
    pub message: String,
}

/// A verification receipt capturing the result of verifying a Block graph.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerificationReceipt {
    #[serde(rename = "receiptVersion")]
    pub receipt_version: String,
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    #[serde(rename = "verifiedAt")]
    pub verified_at: u64,
    pub verifier: VerifierInfo,
    pub root: String,
    #[serde(rename = "validationMode")]
    pub validation_mode: String,
    pub ok: bool,
    pub complete: bool,
    #[serde(rename = "blockCount")]
    pub block_count: u64,
    #[serde(rename = "edgeCount")]
    pub edge_count: u64,
    #[serde(rename = "externalParents")]
    pub external_parents: Vec<String>,
    #[serde(rename = "missingParents")]
    pub missing_parents: Vec<String>,
    pub errors: Vec<ReceiptError>,
    pub warnings: Vec<ReceiptError>,
    #[serde(rename = "traceHash", skip_serializing_if = "Option::is_none")]
    pub trace_hash: Option<String>,
}

/// Builder for VerificationReceipt.
pub struct ReceiptBuilder {
    root: String,
    validation_mode: String,
    ok: bool,
    complete: bool,
    block_count: u64,
    edge_count: u64,
    external_parents: Vec<String>,
    missing_parents: Vec<String>,
    errors: Vec<ReceiptError>,
    warnings: Vec<ReceiptError>,
    verifier_name: String,
    verifier_version: String,
    verified_at: Option<u64>,
    trace_hash: Option<String>,
}

impl ReceiptBuilder {
    pub fn new(
        root: String,
        validation_mode: String,
        ok: bool,
        complete: bool,
        block_count: u64,
        edge_count: u64,
    ) -> Self {
        Self {
            root,
            validation_mode,
            ok,
            complete,
            block_count,
            edge_count,
            external_parents: vec![],
            missing_parents: vec![],
            errors: vec![],
            warnings: vec![],
            verifier_name: "alx".to_string(),
            verifier_version: "1.0.0".to_string(),
            verified_at: None,
            trace_hash: None,
        }
    }

    pub fn external_parents(mut self, v: Vec<String>) -> Self {
        self.external_parents = v;
        self
    }

    pub fn missing_parents(mut self, v: Vec<String>) -> Self {
        self.missing_parents = v;
        self
    }

    pub fn errors(mut self, v: Vec<ReceiptError>) -> Self {
        self.errors = v;
        self
    }

    pub fn warnings(mut self, v: Vec<ReceiptError>) -> Self {
        self.warnings = v;
        self
    }

    pub fn verifier(mut self, name: String, version: String) -> Self {
        self.verifier_name = name;
        self.verifier_version = version;
        self
    }

    pub fn verified_at(mut self, ts: u64) -> Self {
        self.verified_at = Some(ts);
        self
    }

    pub fn trace_hash(mut self, h: String) -> Self {
        self.trace_hash = Some(h);
        self
    }

    pub fn build(self) -> VerificationReceipt {
        let verified_at = self.verified_at.unwrap_or_else(|| {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0)
        });
        VerificationReceipt {
            receipt_version: "1".to_string(),
            protocol_version: "1".to_string(),
            verified_at,
            verifier: VerifierInfo {
                name: self.verifier_name,
                version: self.verifier_version,
            },
            root: self.root,
            validation_mode: self.validation_mode,
            ok: self.ok,
            complete: self.complete,
            block_count: self.block_count,
            edge_count: self.edge_count,
            external_parents: self.external_parents,
            missing_parents: self.missing_parents,
            errors: self.errors,
            warnings: self.warnings,
            trace_hash: self.trace_hash,
        }
    }
}

/// Validate a VerificationReceipt against schema constraints.
///
/// Returns `Ok(())` on success or `Err(problems)` with a list of violation descriptions.
pub fn validate_receipt(r: &VerificationReceipt) -> Result<(), Vec<String>> {
    let mut problems: Vec<String> = Vec::new();

    if r.receipt_version != "1" {
        problems.push("receiptVersion must be '1'".to_string());
    }

    if r.protocol_version != "1" {
        problems.push("protocolVersion must be '1'".to_string());
    }

    if !hash_pattern().is_match(&r.root) {
        problems.push("root must match ^0x[a-f0-9]{64}$".to_string());
    }

    if r.validation_mode != "closed-world" && r.validation_mode != "open-world" {
        problems.push("validationMode must be 'closed-world' or 'open-world'".to_string());
    }

    // Schema allOf constraint 1: ok=false requires at least one error
    if !r.ok && r.errors.is_empty() {
        problems.push("ok=false requires at least one entry in errors".to_string());
    }

    // Schema allOf constraint 2: ok=true + closed-world requires complete=true
    if r.ok && r.validation_mode == "closed-world" && !r.complete {
        problems.push("closed-world ok=true requires complete=true".to_string());
    }

    // Schema allOf constraint 3: non-empty externalParents requires complete=false
    if !r.external_parents.is_empty() && r.complete {
        problems.push("complete must be false when externalParents is non-empty".to_string());
    }

    // Validate traceHash format if present
    if let Some(ref th) = r.trace_hash {
        if !hash_pattern().is_match(th) {
            problems.push("traceHash must match ^0x[a-f0-9]{64}$".to_string());
        }
    }

    if problems.is_empty() {
        Ok(())
    } else {
        Err(problems)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROOT: &str = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const EXTERNAL: &str = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    fn base_builder() -> ReceiptBuilder {
        ReceiptBuilder::new(ROOT.to_string(), "closed-world".to_string(), true, true, 2, 1)
            .verified_at(1710000000)
    }

    #[test]
    fn test_build_closed_world_complete() {
        let r = base_builder().build();
        assert_eq!(r.receipt_version, "1");
        assert_eq!(r.protocol_version, "1");
        assert_eq!(r.verified_at, 1710000000);
        assert_eq!(r.verifier.name, "alx");
        assert_eq!(r.root, ROOT);
        assert_eq!(r.validation_mode, "closed-world");
        assert!(r.ok);
        assert!(r.complete);
        assert_eq!(r.block_count, 2);
        assert_eq!(r.edge_count, 1);
        assert!(r.external_parents.is_empty());
        assert!(r.errors.is_empty());
        assert!(r.trace_hash.is_none());
    }

    #[test]
    fn test_validate_closed_world_complete() {
        let r = base_builder().build();
        assert!(validate_receipt(&r).is_ok());
    }

    #[test]
    fn test_validate_open_world_partial() {
        let r = ReceiptBuilder::new(ROOT.to_string(), "open-world".to_string(), true, false, 2, 2)
            .verified_at(1710000000)
            .external_parents(vec![EXTERNAL.to_string()])
            .build();
        assert!(validate_receipt(&r).is_ok());
    }

    #[test]
    fn test_validate_failed_with_errors() {
        let r = ReceiptBuilder::new(ROOT.to_string(), "closed-world".to_string(), false, false, 1, 0)
            .verified_at(1710000000)
            .errors(vec![ReceiptError {
                code: "ALX_BLOCK_HASH_MISMATCH".to_string(),
                message: "Hash mismatch.".to_string(),
            }])
            .build();
        assert!(validate_receipt(&r).is_ok());
    }

    #[test]
    fn test_rejects_ok_false_without_errors() {
        let r = ReceiptBuilder::new(ROOT.to_string(), "closed-world".to_string(), false, false, 1, 0)
            .verified_at(1710000000)
            .build();
        let result = validate_receipt(&r);
        assert!(result.is_err());
        let problems = result.unwrap_err();
        assert!(problems.iter().any(|p| p.contains("errors")));
    }

    #[test]
    fn test_rejects_closed_world_ok_true_incomplete() {
        let r = ReceiptBuilder::new(ROOT.to_string(), "closed-world".to_string(), true, false, 1, 0)
            .verified_at(1710000000)
            .build();
        let result = validate_receipt(&r);
        assert!(result.is_err());
        let problems = result.unwrap_err();
        assert!(problems.iter().any(|p| p.contains("complete")));
    }

    #[test]
    fn test_rejects_complete_true_with_external_parents() {
        let r = ReceiptBuilder::new(ROOT.to_string(), "open-world".to_string(), true, true, 2, 1)
            .verified_at(1710000000)
            .external_parents(vec![EXTERNAL.to_string()])
            .build();
        let result = validate_receipt(&r);
        assert!(result.is_err());
    }

    #[test]
    fn test_rejects_bad_root() {
        let r = ReceiptBuilder::new("not-a-hash".to_string(), "closed-world".to_string(), true, true, 1, 0)
            .verified_at(1710000000)
            .build();
        let result = validate_receipt(&r);
        assert!(result.is_err());
    }

    #[test]
    fn test_json_round_trip() {
        let r = base_builder().build();
        let json = serde_json::to_string(&r).unwrap();
        let parsed: VerificationReceipt = serde_json::from_str(&json).unwrap();
        assert_eq!(r, parsed);
    }

    #[test]
    fn test_trace_hash_field() {
        let th = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
        let r = base_builder().trace_hash(th.to_string()).build();
        assert_eq!(r.trace_hash, Some(th.to_string()));
        assert!(validate_receipt(&r).is_ok());

        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("traceHash"));

        let r_no_trace = base_builder().build();
        let json_no_trace = serde_json::to_string(&r_no_trace).unwrap();
        assert!(!json_no_trace.contains("traceHash"));
    }
}
