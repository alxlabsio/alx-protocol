"""ALX Protocol — Sorted-pair Merkle tree for checkpoint proofs."""

from typing import List, Optional, Dict
from eth_hash.auto import keccak


def _hash_pair(a: str, b: str) -> str:
    a_bytes = bytes.fromhex(a[2:])
    b_bytes = bytes.fromhex(b[2:])
    if a.lower() < b.lower():
        concat = a_bytes + b_bytes
    else:
        concat = b_bytes + a_bytes
    return "0x" + keccak(concat).hex()


def build_merkle_tree(leaves: List[str]) -> dict:
    if not leaves:
        raise ValueError("leaves must be a non-empty list")
    layer = sorted(h.lower() for h in leaves)
    layers = [list(layer)]
    while len(layer) > 1:
        next_layer = []
        for i in range(0, len(layer), 2):
            if i + 1 < len(layer):
                next_layer.append(_hash_pair(layer[i], layer[i + 1]))
            else:
                next_layer.append(layer[i])
        layer = next_layer
        layers.append(list(layer))
    return {"root": layer[0], "layers": layers}


def get_merkle_proof(leaves: List[str], leaf: str) -> Optional[Dict]:
    tree = build_merkle_tree(leaves)
    target = leaf.lower()
    try:
        index = tree["layers"][0].index(target)
    except ValueError:
        return None
    proof = []
    idx = index
    for i in range(len(tree["layers"]) - 1):
        layer_len = len(tree["layers"][i])
        sibling = idx + 1 if idx % 2 == 0 else idx - 1
        if sibling < layer_len:
            proof.append(tree["layers"][i][sibling])
        idx //= 2
    return {"proof": proof, "root": tree["root"], "leaf": target, "index": index}


def verify_merkle_proof(root: str, leaf: str, proof: List[str]) -> bool:
    h = leaf.lower()
    for sibling in proof:
        h = _hash_pair(h, sibling)
    return h == root.lower()
