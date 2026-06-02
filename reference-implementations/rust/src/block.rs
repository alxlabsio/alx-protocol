//! ALX Protocol — Block primitive.

use serde_json::Value;
use sha3::{Digest, Keccak256};
use crate::canonical::canonicalize;
use crate::signatures::{BlockAttestation, Signer, Verifier};
use regex::Regex;
use std::collections::BTreeSet;
use std::sync::LazyLock;

static HASH_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^0x[a-f0-9]{64}$").unwrap());
pub const MAX_PARENTS: usize = 256;

#[derive(Debug, Clone)]
pub struct Block {
    pub block_hash: String,
    pub content_hash: String,
    pub parent_hashes: Vec<String>,
    pub content: Value,
    /// Protocol algorithm version. Excluded from hash derivation. Absent means "1".
    pub protocol_version: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SignedBlock {
    pub block: Block,
    pub attestation: Option<BlockAttestation>,
    pub attestations: Vec<BlockAttestation>,
}

#[derive(Debug, Clone)]
pub struct AttestationValidation {
    pub ok: bool,
    pub attester: String,
    pub algorithm: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BlockValidation {
    pub ok: bool,
    pub expected: String,
    pub actual: String,
    pub expected_content_hash: Option<String>,
    pub actual_content_hash: Option<String>,
    pub canonical_parents: Option<Vec<String>>,
    pub parents_canonical: Option<bool>,
    pub self_ref: Option<bool>,
    pub attestation: Option<AttestationValidation>,
    pub attestations: Vec<AttestationValidation>,
}

pub fn derive_block_hash(content: &Value, parent_hashes: &[String]) -> Result<String, String> {
    let parents = normalize_hashes(parent_hashes)?;
    let parents_val: Vec<Value> = parents.iter().map(|s| Value::String(s.clone())).collect();
    let input = serde_json::json!({"content": content, "parentHashes": parents_val});
    let canonical = canonicalize(&input)?;
    Ok(format!("0x{}", hex::encode(Keccak256::digest(canonical.as_bytes()))))
}

pub fn derive_content_hash(content: &Value) -> Result<String, String> {
    let canonical = canonicalize(content)?;
    Ok(format!("0x{}", hex::encode(Keccak256::digest(canonical.as_bytes()))))
}

pub fn create_block(content: Value, parent_hashes: &[String]) -> Result<Block, String> {
    let parents = normalize_hashes(parent_hashes)?;
    Ok(Block {
        block_hash: derive_block_hash(&content, &parents)?,
        content_hash: derive_content_hash(&content)?,
        parent_hashes: parents,
        content,
        protocol_version: Some("1".to_string()),
    })
}

fn build_attestation(block_hash: &str, signer: &dyn Signer, timestamp: u64) -> Result<BlockAttestation, String> {
    if signer.algorithm().is_empty() { return Err("signer.algorithm must be a non-empty string".into()); }
    let bytes = hex::decode(block_hash.trim_start_matches("0x")).map_err(|e| e.to_string())?;
    Ok(BlockAttestation { block_hash: block_hash.into(), attester: signer.get_id()?, algorithm: signer.algorithm().into(), timestamp, signature: signer.sign(&bytes)? })
}

pub fn create_signed_block(content: Value, parent_hashes: &[String], signer: &dyn Signer, timestamp: u64) -> Result<SignedBlock, String> {
    let block = create_block(content, parent_hashes)?;
    let att = build_attestation(&block.block_hash, signer, timestamp)?;
    Ok(SignedBlock { block, attestation: Some(att.clone()), attestations: vec![att] })
}

pub fn add_attestation(mut signed_block: SignedBlock, signer: &dyn Signer, timestamp: u64) -> Result<SignedBlock, String> {
    let att = build_attestation(&signed_block.block.block_hash, signer, timestamp)?;
    if signed_block.attestations.is_empty() {
        if let Some(existing) = signed_block.attestation.clone() { signed_block.attestations.push(existing); }
    }
    signed_block.attestations.push(att);
    signed_block.attestation = signed_block.attestations.first().cloned();
    Ok(signed_block)
}

pub fn validate_block_detailed(block: &Block) -> Result<BlockValidation, String> {
    if let Some(v) = &block.protocol_version {
        if v != "1" {
            return Err(format!("[ALX_UNSUPPORTED_VERSION] Unsupported protocolVersion: \"{v}\". Only \"1\" is recognized."));
        }
    }
    let canonical_parents = normalize_hashes(&block.parent_hashes)?;
    let expected = derive_block_hash(&block.content, &block.parent_hashes)?;
    let actual = normalize_hash(&block.block_hash)?;
    let expected_content_hash = derive_content_hash(&block.content)?;
    let actual_content_hash = normalize_hash(&block.content_hash)?;
    let parents_canonical = block.parent_hashes == canonical_parents;
    let self_ref = canonical_parents.contains(&actual);
    let ok = expected == actual && expected_content_hash == actual_content_hash && parents_canonical && !self_ref;
    Ok(BlockValidation {
        ok,
        expected,
        actual,
        expected_content_hash: Some(expected_content_hash),
        actual_content_hash: Some(actual_content_hash),
        canonical_parents: Some(canonical_parents),
        parents_canonical: Some(parents_canonical),
        self_ref: Some(self_ref),
        attestation: None,
        attestations: vec![],
    })
}

/// Validate a block's hash integrity. Returns (ok, expected_hash, actual_hash).
pub fn validate_block(block: &Block) -> Result<(bool, String, String), String> {
    let result = validate_block_detailed(block)?;
    Ok((result.ok, result.expected, result.actual))
}

pub fn validate_signed_block(signed_block: &SignedBlock, verifiers: &[&dyn Verifier]) -> Result<BlockValidation, String> {
    let block = &signed_block.block;
    let mut result = validate_block_detailed(block)?;
    let attestations = if !signed_block.attestations.is_empty() { signed_block.attestations.clone() } else { signed_block.attestation.clone().into_iter().collect() };
    if attestations.is_empty() {
        let v = AttestationValidation { ok: false, attester: "".into(), algorithm: "".into(), reason: Some("no attestation present".into()) };
        result.ok = false;
        result.attestation = Some(v.clone());
        result.attestations = vec![];
        return Ok(result);
    }
    let data = hex::decode(block.block_hash.trim_start_matches("0x")).map_err(|e| e.to_string())?;
    let mut validations = vec![];
    for att in attestations {
        if att.block_hash != block.block_hash {
            validations.push(AttestationValidation { ok: false, attester: att.attester, algorithm: att.algorithm, reason: Some("attestation.blockHash does not match block.blockHash".into()) });
            continue;
        }
        let Some(verifier) = verifiers.iter().find(|v| v.algorithm() == att.algorithm) else {
            validations.push(AttestationValidation { ok: false, attester: att.attester, algorithm: att.algorithm, reason: Some("no verifier for algorithm".into()) });
            continue;
        };
        let (ok, signer) = verifier.verify(&data, &att.signature, Some(&att.attester))?;
        validations.push(AttestationValidation { ok, attester: signer, algorithm: att.algorithm, reason: if ok { None } else { Some("signature verification failed".into()) } });
    }
    result.ok = result.ok && validations.iter().all(|v| v.ok);
    result.attestation = validations.first().cloned();
    result.attestations = validations;
    Ok(result)
}

pub fn normalize_hash(h: &str) -> Result<String, String> {
    let s = h.trim().to_lowercase();
    if !HASH_RE.is_match(&s) { return Err(format!("invalid hash: {h}")); }
    Ok(s)
}

pub fn normalize_hashes(hashes: &[String]) -> Result<Vec<String>, String> {
    let mut set = BTreeSet::new();
    for h in hashes {
        let s = h.trim().to_lowercase();
        if HASH_RE.is_match(&s) { set.insert(s); }
    }
    let normalized: Vec<String> = set.into_iter().collect();
    if normalized.len() > MAX_PARENTS {
        return Err(format!("parentHashes exceeds maximum of {MAX_PARENTS} after normalization"));
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct FakeSigner(&'static str);
    impl Signer for FakeSigner {
        fn get_id(&self) -> Result<String, String> { Ok(self.0.into()) }
        fn sign(&self, data: &[u8]) -> Result<String, String> { Ok(format!("{}:{}", self.0, hex::encode(data))) }
        fn algorithm(&self) -> &str { "fake" }
    }

    struct FakeVerifier;
    impl Verifier for FakeVerifier {
        fn verify(&self, data: &[u8], signature: &str, expected_signer: Option<&str>) -> Result<(bool, String), String> {
            let signer = signature.split(':').next().unwrap_or("").to_string();
            let ok = signature == format!("{}:{}", signer, hex::encode(data)) && expected_signer.map_or(true, |expected| expected == signer);
            Ok((ok, signer))
        }
        fn algorithm(&self) -> &str { "fake" }
    }

    #[test]
    fn same_content_same_hash() {
        let a = derive_block_hash(&json!("hello"), &[]).unwrap();
        let b = derive_block_hash(&json!("hello"), &[]).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn different_content_different_hash() {
        let a = derive_block_hash(&json!("hello"), &[]).unwrap();
        let b = derive_block_hash(&json!("world"), &[]).unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn parent_order_doesnt_matter() {
        let p1 = format!("0x{}", "a".repeat(64));
        let p2 = format!("0x{}", "b".repeat(64));
        let a = derive_block_hash(&json!("test"), &[p1.clone(), p2.clone()]).unwrap();
        let b = derive_block_hash(&json!("test"), &[p2, p1]).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn validate_passes_for_valid_block() {
        let block = create_block(json!("test"), &[]).unwrap();
        let (ok, _, _) = validate_block(&block).unwrap();
        assert!(ok);
    }

    #[test]
    fn signed_blocks_support_multiple_attestations() {
        let first = FakeSigner("alice");
        let second = FakeSigner("bob");
        let block = create_signed_block(json!({"type": "decision"}), &[], &first, 1).unwrap();
        let block = add_attestation(block, &second, 2).unwrap();
        let result = validate_signed_block(&block, &[&FakeVerifier]).unwrap();
        assert!(result.ok);
        assert_eq!(block.attestations.len(), 2);
        assert_eq!(block.attestation.unwrap().attester, "alice");
    }

    #[test]
    fn signed_blocks_reject_wrong_attested_hash() {
        let signer = FakeSigner("alice");
        let mut block = create_signed_block(json!({"type": "decision"}), &[], &signer, 1).unwrap();
        block.attestations[0].block_hash = format!("0x{}", "0".repeat(64));
        let result = validate_signed_block(&block, &[&FakeVerifier]).unwrap();
        assert!(!result.ok);
        assert_eq!(result.attestation.unwrap().reason.unwrap(), "attestation.blockHash does not match block.blockHash");
    }
}

