//! Ed25519 signer and verifier backends for ALX Block attestations.

use ed25519_dalek::{Signature, Signer as _, SigningKey, Verifier as _, VerifyingKey};
use crate::signatures::{Signer, Verifier};

pub struct Ed25519Signer {
    signing_key: SigningKey,
}

impl Ed25519Signer {
    pub fn new(private_key: &[u8]) -> Result<Self, String> {
        let bytes: [u8; 32] = private_key.try_into().map_err(|_| "Ed25519 private key must be exactly 32 bytes")?;
        Ok(Self { signing_key: SigningKey::from_bytes(&bytes) })
    }
}

impl Signer for Ed25519Signer {
    fn get_id(&self) -> Result<String, String> {
        Ok(format!("0x{}", hex::encode(self.signing_key.verifying_key().to_bytes())))
    }

    fn sign(&self, data: &[u8]) -> Result<String, String> {
        Ok(format!("0x{}", hex::encode(self.signing_key.sign(data).to_bytes())))
    }

    fn algorithm(&self) -> &str {
        "ed25519"
    }
}

pub struct Ed25519Verifier;

impl Verifier for Ed25519Verifier {
    fn verify(&self, data: &[u8], signature: &str, expected_signer: Option<&str>) -> Result<(bool, String), String> {
        let Some(expected) = expected_signer else { return Ok((false, String::new())); };
        let public_bytes = hex::decode(expected.trim_start_matches("0x")).map_err(|e| e.to_string())?;
        let public_arr: [u8; 32] = public_bytes.try_into().map_err(|_| "Ed25519 public key must be exactly 32 bytes")?;
        let verifying_key = VerifyingKey::from_bytes(&public_arr).map_err(|e| e.to_string())?;
        let sig_bytes = hex::decode(signature.trim_start_matches("0x")).map_err(|e| e.to_string())?;
        let sig_arr: [u8; 64] = sig_bytes.try_into().map_err(|_| "Ed25519 signature must be exactly 64 bytes")?;
        let sig = Signature::from_bytes(&sig_arr);
        Ok((verifying_key.verify(data, &sig).is_ok(), expected.to_string()))
    }

    fn algorithm(&self) -> &str {
        "ed25519"
    }
}
