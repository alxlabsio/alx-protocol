//! ALX Protocol — replay-window helpers.

use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct ReplayResult {
    pub ok: bool,
    pub code: String,
    pub nonce_key: Option<String>,
}

pub fn build_replay_scope_key(actor: &str, nonce: &str, chain_id: Option<u64>, domain: Option<&str>) -> Result<String, String> {
    if actor.is_empty() { return Err("actor is required".into()); }
    if nonce.is_empty() { return Err("nonce is required".into()); }
    Ok([actor.to_string(), nonce.to_string(), chain_id.map_or("*".into(), |v| v.to_string()), domain.unwrap_or("*").to_string()].join("\0"))
}

pub fn validate_replay_window(actor: Option<&str>, nonce: Option<&str>, expiry: Option<u64>, chain_id: Option<u64>, domain: Option<&str>, now_seconds: u64, seen_nonce_keys: &HashSet<String>, expected_chain_id: Option<u64>, expected_domain: Option<&str>, allowed_clock_skew_seconds: u64) -> ReplayResult {
    let actor = actor.unwrap_or("");
    let nonce = nonce.unwrap_or("");
    if actor.is_empty() { return ReplayResult { ok: false, code: "missing_actor".into(), nonce_key: None }; }
    if nonce.is_empty() { return ReplayResult { ok: false, code: "missing_nonce".into(), nonce_key: None }; }
    let Some(expiry) = expiry else { return ReplayResult { ok: false, code: "missing_expiry".into(), nonce_key: None }; };
    if expected_chain_id.is_some() && chain_id != expected_chain_id { return ReplayResult { ok: false, code: "chain_mismatch".into(), nonce_key: None }; }
    if expected_domain.is_some() && domain != expected_domain { return ReplayResult { ok: false, code: "domain_mismatch".into(), nonce_key: None }; }
    if expiry.saturating_add(allowed_clock_skew_seconds) < now_seconds { return ReplayResult { ok: false, code: "expired".into(), nonce_key: None }; }
    let nonce_key = build_replay_scope_key(actor, nonce, chain_id, domain).unwrap();
    if seen_nonce_keys.contains(&nonce_key) { return ReplayResult { ok: false, code: "replayed_nonce".into(), nonce_key: Some(nonce_key) }; }
    ReplayResult { ok: true, code: "ok".into(), nonce_key: Some(nonce_key) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_window_rejects_seen_nonce() {
        let nonce_key = build_replay_scope_key("alice", "n-1", Some(8453), Some("alx")).unwrap();
        let mut seen = HashSet::new();
        seen.insert(nonce_key.clone());
        let result = validate_replay_window(Some("alice"), Some("n-1"), Some(200), Some(8453), Some("alx"), 100, &seen, None, None, 0);
        assert!(!result.ok);
        assert_eq!(result.code, "replayed_nonce");
        assert_eq!(result.nonce_key.unwrap(), nonce_key);
    }
}

