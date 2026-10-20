//! P-256 signer and verifier backends for ALX Block attestations.

use crate::signatures::{Signer, Verifier};
use p256::ecdsa::{
    signature::hazmat::{PrehashSigner, PrehashVerifier},
    Signature, SigningKey, VerifyingKey,
};

fn is_lower_hex(value: &str, bytes: usize) -> bool {
    value.len() == 2 + bytes * 2
        && value.starts_with("0x")
        && value.as_bytes()[2..]
            .iter()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(byte))
}

pub struct P256Signer {
    signing_key: SigningKey,
}

impl P256Signer {
    pub fn new(private_key: &[u8]) -> Result<Self, String> {
        let bytes: [u8; 32] = private_key
            .try_into()
            .map_err(|_| "P-256 private key must be exactly 32 bytes")?;
        let signing_key = SigningKey::from_bytes((&bytes).into()).map_err(|e| e.to_string())?;
        Ok(Self { signing_key })
    }
}

impl Signer for P256Signer {
    fn get_id(&self) -> Result<String, String> {
        let point = self.signing_key.verifying_key().to_encoded_point(false);
        Ok(format!("0x{}", hex::encode(point.as_bytes())))
    }

    fn sign(&self, data: &[u8]) -> Result<String, String> {
        if data.len() != 32 {
            return Err("P-256 attestation input must be a 32-byte digest".into());
        }
        let signature: Signature = self
            .signing_key
            .sign_prehash(data)
            .map_err(|e| e.to_string())?;
        let signature = signature.normalize_s().unwrap_or(signature);
        Ok(format!("0x{}", hex::encode(signature.to_bytes())))
    }

    fn algorithm(&self) -> &str {
        "p256"
    }
}

pub struct P256Verifier;

impl Verifier for P256Verifier {
    fn verify(
        &self,
        data: &[u8],
        signature: &str,
        expected_signer: Option<&str>,
    ) -> Result<(bool, String), String> {
        let Some(expected) = expected_signer else {
            return Ok((false, String::new()));
        };
        if data.len() != 32
            || !is_lower_hex(expected, 65)
            || !expected.starts_with("0x04")
            || !is_lower_hex(signature, 64)
        {
            return Ok((false, expected.to_string()));
        }
        let public_bytes =
            hex::decode(expected.trim_start_matches("0x")).map_err(|e| e.to_string())?;
        let verifying_key =
            VerifyingKey::from_sec1_bytes(&public_bytes).map_err(|e| e.to_string())?;
        let sig_bytes =
            hex::decode(signature.trim_start_matches("0x")).map_err(|e| e.to_string())?;
        let Ok(signature) = Signature::from_slice(&sig_bytes) else {
            return Ok((false, expected.to_string()));
        };
        if signature.normalize_s().is_some() {
            return Ok((false, expected.to_string()));
        }
        Ok((
            verifying_key.verify_prehash(data, &signature).is_ok(),
            expected.to_string(),
        ))
    }

    fn algorithm(&self) -> &str {
        "p256"
    }
}
