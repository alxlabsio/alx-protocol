//! ALX Protocol — algorithm-agnostic signing interfaces.

#[derive(Debug, Clone)]
pub struct BlockAttestation {
    pub block_hash: String,
    pub attester: String,
    pub algorithm: String,
    pub timestamp: u64,
    pub signature: String,
}

pub trait Signer {
    fn get_id(&self) -> Result<String, String>;
    fn sign(&self, data: &[u8]) -> Result<String, String>;
    fn algorithm(&self) -> &str;
}

pub trait Verifier {
    fn verify(&self, data: &[u8], signature: &str, expected_signer: Option<&str>) -> Result<(bool, String), String>;
    fn algorithm(&self) -> &str;
}
