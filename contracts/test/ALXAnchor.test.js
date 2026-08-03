const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const HASH_A = "0x" + "aa".repeat(32);
const HASH_B = "0x" + "bb".repeat(32);
const HASH_C = "0x" + "cc".repeat(32);
const BATCH_ID  = ethers.keccak256(ethers.toUtf8Bytes("release-v1.0.0"));
const ZERO    = "0x" + "00".repeat(32);

describe("ALXAnchor", function () {
  let contract, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const ALXAnchor = await ethers.getContractFactory("ALXAnchor");
    contract = await ALXAnchor.deploy();
  });

  // ── anchor() ──────────────────────────────────────────────────────────────

  describe("anchor()", function () {
    it("records timestamp and sender on first call", async function () {
      const tx = await contract.anchor(HASH_A);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      expect(await contract.anchoredAt(HASH_A)).to.equal(block.timestamp);
      expect(await contract.anchoredBy(HASH_A)).to.equal(owner.address);
    });

    it("emits Anchored with indexed blockHash and by", async function () {
      await expect(contract.anchor(HASH_A))
        .to.emit(contract, "Anchored")
        .withArgs(HASH_A, owner.address, anyValue);
    });

    it("reverts AlreadyAnchored on duplicate call", async function () {
      await contract.anchor(HASH_A);
      await expect(contract.anchor(HASH_A))
        .to.be.revertedWithCustomError(contract, "AlreadyAnchored")
        .withArgs(HASH_A);
    });

    it("different callers anchor different hashes independently", async function () {
      await contract.connect(owner).anchor(HASH_A);
      await contract.connect(other).anchor(HASH_B);
      expect(await contract.anchoredBy(HASH_A)).to.equal(owner.address);
      expect(await contract.anchoredBy(HASH_B)).to.equal(other.address);
    });

    it("accepts zero bytes32 as a valid hash input", async function () {
      await expect(contract.anchor(ZERO)).to.emit(contract, "Anchored");
    });
  });

  // ── anchorBatch() ──────────────────────────────────────────────────────

  describe("anchorBatch()", function () {
    it("anchors all hashes and emits BatchAnchored with correct count", async function () {
      await expect(contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B, HASH_C]))
        .to.emit(contract, "BatchAnchored")
        .withArgs(BATCH_ID, owner.address, anyValue, 3);
      expect(await contract.isAnchored(HASH_A)).to.be.true;
      expect(await contract.isAnchored(HASH_B)).to.be.true;
      expect(await contract.isAnchored(HASH_C)).to.be.true;
    });

    it("emits individual Anchored events for each new hash", async function () {
      const tx = contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B]);
      await expect(tx).to.emit(contract, "Anchored").withArgs(HASH_A, owner.address, anyValue);
      await expect(tx).to.emit(contract, "Anchored").withArgs(HASH_B, owner.address, anyValue);
    });

    it("skips already-anchored hashes and counts only new ones", async function () {
      await contract.anchor(HASH_A);
      await expect(contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B]))
        .to.emit(contract, "BatchAnchored")
        .withArgs(BATCH_ID, owner.address, anyValue, 1);
      // HASH_A original timestamp preserved
      const ts = await contract.anchoredAt(HASH_A);
      expect(ts).to.be.gt(0n);
    });

    it("emits BatchAnchored with count 0 when all hashes already anchored", async function () {
      await contract.anchor(HASH_A);
      await contract.anchor(HASH_B);
      await expect(contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B]))
        .to.emit(contract, "BatchAnchored")
        .withArgs(BATCH_ID, owner.address, anyValue, 0);
    });

    it("reverts BatchTooSmall with 0 hashes", async function () {
      await expect(contract.anchorBatch(BATCH_ID, []))
        .to.be.revertedWithCustomError(contract, "BatchTooSmall")
        .withArgs(0, 2);
    });

    it("reverts BatchTooSmall with exactly 1 hash", async function () {
      await expect(contract.anchorBatch(BATCH_ID, [HASH_A]))
        .to.be.revertedWithCustomError(contract, "BatchTooSmall")
        .withArgs(1, 2);
    });

    it("accepts exactly 2 hashes (batch minimum)", async function () {
      await expect(contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B]))
        .to.emit(contract, "BatchAnchored")
        .withArgs(BATCH_ID, owner.address, anyValue, 2);
    });

    it("reverts BatchTooLarge above MAX_BATCH_SIZE", async function () {
      const max = await contract.MAX_BATCH_SIZE();
      expect(max).to.equal(256n);
      const hashes = Array.from({ length: 257 }, (_, i) =>
        "0x" + (i + 1).toString(16).padStart(64, "0"),
      );
      await expect(contract.anchorBatch(BATCH_ID, hashes))
        .to.be.revertedWithCustomError(contract, "BatchTooLarge")
        .withArgs(257, 256);
    });
  });

  // ── isAnchored() ──────────────────────────────────────────────────────────

  describe("isAnchored()", function () {
    it("returns false before any anchor call", async function () {
      expect(await contract.isAnchored(HASH_A)).to.be.false;
    });

    it("returns true after anchor()", async function () {
      await contract.anchor(HASH_A);
      expect(await contract.isAnchored(HASH_A)).to.be.true;
    });

    it("returns true after anchorBatch()", async function () {
      await contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B]);
      expect(await contract.isAnchored(HASH_A)).to.be.true;
      expect(await contract.isAnchored(HASH_B)).to.be.true;
    });

    it("returns false for unanchored hash after an anchored batch", async function () {
      await contract.anchorBatch(BATCH_ID, [HASH_A, HASH_B]);
      expect(await contract.isAnchored(HASH_C)).to.be.false;
    });
  });

  // ── Gas ───────────────────────────────────────────────────────────────────

  describe("gas", function () {
    it("single anchor costs under 50 000 gas", async function () {
      const tx = await contract.anchor(HASH_A);
      const receipt = await tx.wait();
      expect(receipt.gasUsed).to.be.lt(50_000n);
    });

    it("batch of 10 hashes costs under 300 000 gas", async function () {
      const hashes = Array.from({ length: 10 }, (_, i) =>
        "0x" + i.toString(16).padStart(64, "0")
      );
      const tx = await contract.anchorBatch(BATCH_ID, hashes);
      const receipt = await tx.wait();
      expect(receipt.gasUsed).to.be.lt(300_000n);
    });
  });
});
