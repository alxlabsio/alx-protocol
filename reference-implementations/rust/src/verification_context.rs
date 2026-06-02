//! Verification-context model kept outside the v1 Block primitive.

#[derive(Debug, Clone)]
pub enum ValidationMode {
    ClosedWorld,
    OpenWorld,
}

#[derive(Debug, Clone)]
pub struct ExternalParentBoundary {
    pub hash: String,
    pub reason: String,
    pub declared_by: String,
    pub required_for_full_validation: bool,
}

#[derive(Debug, Clone)]
pub struct VerificationContext {
    pub protocol_version: String,
    pub validation_mode: ValidationMode,
    pub graph_root: String,
    pub extensions: Vec<String>,
    pub external_parents: Vec<ExternalParentBoundary>,
}
