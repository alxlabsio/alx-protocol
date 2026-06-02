//! ALX Protocol — Sorted-pair Merkle tree.

use sha3::{Digest, Keccak256};

#[derive(Debug)]
pub struct MerkleTree {
    pub root: String,
    pub layers: Vec<Vec<String>>,
}

#[derive(Debug)]
pub struct MerkleProof {
    pub proof: Vec<String>,
    pub root: String,
    pub leaf: String,
    pub index: usize,
}

fn hash_pair(a: &str, b: &str) -> String {
    let a_bytes = hex::decode(&a[2..]).expect("valid hex");
    let b_bytes = hex::decode(&b[2..]).expect("valid hex");
    let concat = if a.to_lowercase() < b.to_lowercase() {
        [a_bytes, b_bytes].concat()
    } else {
        [b_bytes, a_bytes].concat()
    };
    format!("0x{}", hex::encode(Keccak256::digest(&concat)))
}

pub fn build_merkle_tree(leaves: &[String]) -> Result<MerkleTree, String> {
    if leaves.is_empty() { return Err("leaves must be non-empty".into()); }
    let mut layer: Vec<String> = leaves.iter().map(|h| h.to_lowercase()).collect();
    layer.sort();
    let mut layers = vec![layer.clone()];
    while layer.len() > 1 {
        let mut next = vec![];
        for i in (0..layer.len()).step_by(2) {
            if i + 1 < layer.len() {
                next.push(hash_pair(&layer[i], &layer[i + 1]));
            } else {
                next.push(layer[i].clone());
            }
        }
        layer = next;
        layers.push(layer.clone());
    }
    Ok(MerkleTree { root: layer[0].clone(), layers })
}

pub fn get_merkle_proof(leaves: &[String], leaf: &str) -> Result<Option<MerkleProof>, String> {
    let tree = build_merkle_tree(leaves)?;
    let target = leaf.to_lowercase();
    let index = match tree.layers[0].iter().position(|h| *h == target) {
        Some(i) => i,
        None => return Ok(None),
    };
    let mut proof = vec![];
    let mut idx = index;
    for i in 0..tree.layers.len() - 1 {
        let sibling = if idx % 2 == 0 { idx + 1 } else { idx - 1 };
        if sibling < tree.layers[i].len() {
            proof.push(tree.layers[i][sibling].clone());
        }
        idx /= 2;
    }
    Ok(Some(MerkleProof { proof, root: tree.root.clone(), leaf: target, index }))
}

pub fn verify_merkle_proof(root: &str, leaf: &str, proof: &[String]) -> bool {
    let mut hash = leaf.to_lowercase();
    for sibling in proof {
        hash = hash_pair(&hash, sibling);
    }
    hash == root.to_lowercase()
}
