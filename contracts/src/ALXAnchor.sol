// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ALXAnchor
/// @author ALX Labs
/// @notice Trustless existence-time registry for ALX Protocol Blocks and hash batches on Base.
/// @dev Admin-free, upgrade-free, permissionless.
///      Content opacity (ADR-002): accepts bytes32 only — Block content stays opaque.
///      No-consensus (ADR-003): records timestamps only.
///      Verification is local: validateBlock() runs off-chain; this contract trusts the hash.
///      Deployment: protocol/chains/base-mainnet.json → contracts.anchor.deployments
contract ALXAnchor {

    // ── Errors ────────────────────────────────────────────────────────────────

    /// @notice Thrown when a blockHash has already been anchored.
    /// @param blockHash The blockHash that was already anchored.
    error AlreadyAnchored(bytes32 blockHash);

    /// @notice Thrown when a hash batch contains fewer than 2 hashes.
    /// @dev Minimum of 2 enforced per glossary.md hash batch definition.
    /// @param provided Number of hashes supplied by the caller.
    /// @param minimum  Minimum required (always 2).
    error BatchTooSmall(uint256 provided, uint256 minimum);

    /// @notice Thrown when a hash batch exceeds the on-chain batch limit.
    /// @param provided Number of hashes supplied by the caller.
    /// @param maximum  Maximum allowed (256, aligned with protocol parent limit).
    error BatchTooLarge(uint256 provided, uint256 maximum);

    /// @notice Application batch ceiling matching the v1 parent-count maximum.
    uint256 public constant MAX_BATCH_SIZE = 256;

    // ── State ─────────────────────────────────────────────────────────────────

    /// @dev Packs the anchoring address and timestamp into one storage slot per blockHash.
    ///      Bits 64..223 hold the address; bits 0..63 hold the timestamp.
    mapping(bytes32 => uint256) private anchors;

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a single blockHash is anchored.
    /// @param blockHash The ALX Protocol Block identity hash (keccak-256 of canonical payload).
    /// @param by        The address that submitted the anchor transaction.
    /// @param at        The block.timestamp at the time of anchoring.
    event Anchored(bytes32 indexed blockHash, address indexed by, uint256 at);

    /// @notice Emitted once per anchorBatch call regardless of how many hashes were new.
    /// @param batchId Application-defined identifier for this hash batch.
    /// @param by    The address that submitted the anchor transaction.
    /// @param at    The block.timestamp at the time of anchoring.
    /// @param count Number of blockHashes newly anchored in this call (count covers newly anchored hashes only).
    event BatchAnchored(bytes32 indexed batchId, address indexed by, uint256 at, uint256 count);

    // ── Write functions ───────────────────────────────────────────────────────

    /// @notice Anchor a single blockHash.
    /// @dev Reverts with AlreadyAnchored if the blockHash has been anchored before.
    ///      Callers MUST run local validateBlock() before anchoring — hash derivation
    ///      stays local (content opacity, ADR-002).
    /// @param blockHash The ALX Protocol blockHash to anchor.
    function anchor(bytes32 blockHash) external {
        if (anchors[blockHash] != 0) revert AlreadyAnchored(blockHash);
        _record(blockHash);
        emit Anchored(blockHash, msg.sender, block.timestamp);
    }

    /// @notice Anchor a hash batch — a named group of two or more blockHashes.
    /// @dev Already-anchored hashes are silently skipped; only new anchors increment count.
    ///      The contract stores per-hash timestamps only; set membership stays application-defined.
    ///      Minimum of 2 enforced per glossary.md.
    /// @param batchId       Application identifier for this hash batch (e.g. keccak256("release-v1.0.0")).
    /// @param blockHashes Array of ALX Protocol blockHashes to anchor (minimum 2 entries).
    function anchorBatch(bytes32 batchId, bytes32[] calldata blockHashes) external {
        if (blockHashes.length < 2) revert BatchTooSmall(blockHashes.length, 2);
        if (blockHashes.length > MAX_BATCH_SIZE) {
            revert BatchTooLarge(blockHashes.length, MAX_BATCH_SIZE);
        }
        uint256 newlyAnchored = 0;
        uint256 len = blockHashes.length;
        for (uint256 i = 0; i < len; ++i) {
            bytes32 h = blockHashes[i];
            if (anchors[h] == 0) {
                _record(h);
                emit Anchored(h, msg.sender, block.timestamp);
                ++newlyAnchored;
            }
        }
        emit BatchAnchored(batchId, msg.sender, block.timestamp, newlyAnchored);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// @notice Returns true if the blockHash has been anchored.
    /// @param blockHash The ALX Protocol blockHash to check.
    /// @return True if anchoredAt[blockHash] is non-zero.
    function isAnchored(bytes32 blockHash) external view returns (bool) {
        return anchors[blockHash] != 0;
    }

    /// @notice Timestamp at which a blockHash was first anchored (0 = unanchored).
    /// @param blockHash The ALX Protocol blockHash to inspect.
    function anchoredAt(bytes32 blockHash) external view returns (uint256) {
        return uint64(anchors[blockHash]);
    }

    /// @notice Address that first anchored a given blockHash.
    /// @param blockHash The ALX Protocol blockHash to inspect.
    function anchoredBy(bytes32 blockHash) external view returns (address) {
        return address(uint160(anchors[blockHash] >> 64));
    }

    function _record(bytes32 blockHash) private {
        anchors[blockHash] = (uint256(uint160(msg.sender)) << 64) | uint64(block.timestamp);
    }
}
