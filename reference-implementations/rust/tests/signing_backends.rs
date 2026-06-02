use alx_protocol::{
    create_signed_block,
    validate_signed_block,
    Ed25519Signer,
    Ed25519Verifier,
    P256Signer,
    P256Verifier,
};
use serde_json::json;

#[test]
fn ed25519_round_trip_signed_block() {
    let signer = Ed25519Signer::new(&[1u8; 32]).unwrap();
    let verifier = Ed25519Verifier;
    let signed = create_signed_block(json!({"workflow": "security-review", "decision": "approve"}), &[], &signer, 1).unwrap();
    let result = validate_signed_block(&signed, &[&verifier]).unwrap();
    assert!(result.ok);
}

#[test]
fn ed25519_rejects_tampered_signature() {
    let signer = Ed25519Signer::new(&[2u8; 32]).unwrap();
    let verifier = Ed25519Verifier;
    let mut signed = create_signed_block(json!({"workflow": "research-synthesis"}), &[], &signer, 1).unwrap();
    signed.attestations[0].signature = format!("0x{}", "ff".repeat(64));
    let result = validate_signed_block(&signed, &[&verifier]).unwrap();
    assert!(!result.ok);
}

#[test]
fn p256_round_trip_signed_block() {
    let signer = P256Signer::new(&[3u8; 32]).unwrap();
    let verifier = P256Verifier;
    let signed = create_signed_block(json!({"workflow": "model-release", "decision": "staged"}), &[], &signer, 1).unwrap();
    let result = validate_signed_block(&signed, &[&verifier]).unwrap();
    assert!(result.ok);
}

#[test]
fn p256_rejects_tampered_signature() {
    let signer = P256Signer::new(&[4u8; 32]).unwrap();
    let verifier = P256Verifier;
    let mut signed = create_signed_block(json!({"workflow": "compliance-audit"}), &[], &signer, 1).unwrap();
    signed.attestations[0].signature = format!("0x{}", "ff".repeat(64));
    let result = validate_signed_block(&signed, &[&verifier]).unwrap();
    assert!(!result.ok);
}
