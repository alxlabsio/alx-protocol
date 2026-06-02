import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function dist(name) { return pathToFileURL(resolve(__dirname, "../../dist", name)).href; }

const { createBlock, createSignedBlock, validateSignedBlock } = await import(dist("block.js"));

// Check if @noble/ed25519 is available
let ed25519Available = false;
let Ed25519Signer, Ed25519Verifier;
try {
  const mod = await import(dist("ed25519.js"));
  Ed25519Signer = mod.Ed25519Signer;
  Ed25519Verifier = mod.Ed25519Verifier;
  // Try loading the actual crypto library
  await import("@noble/ed25519");
  ed25519Available = true;
} catch {
  // @noble/ed25519 not installed — skip crypto tests, run interface tests only
}

describe("Ed25519 Signer/Verifier interface", () => {
  it("Ed25519Signer has correct interface shape", () => {
    assert.ok(Ed25519Signer, "Ed25519Signer should be exported");
    const signer = new Ed25519Signer("0x" + "ab".repeat(32));
    assert.equal(signer.algorithm, "ed25519");
    assert.equal(typeof signer.getId, "function");
    assert.equal(typeof signer.sign, "function");
  });

  it("Ed25519Verifier has correct interface shape", () => {
    assert.ok(Ed25519Verifier, "Ed25519Verifier should be exported");
    const verifier = new Ed25519Verifier();
    assert.equal(verifier.algorithm, "ed25519");
    assert.equal(typeof verifier.verify, "function");
  });

  it("Ed25519Verifier rejects when no expected signer provided", async () => {
    const verifier = new Ed25519Verifier();
    const result = await verifier.verify(new Uint8Array(32), "0x" + "ab".repeat(64));
    assert.equal(result.ok, false);
    assert.equal(result.signer, "");
  });

  it("algorithm matches between signer and verifier", () => {
    const signer = new Ed25519Signer("0x" + "ab".repeat(32));
    const verifier = new Ed25519Verifier();
    assert.equal(signer.algorithm, verifier.algorithm);
  });
});

// Real crypto tests — only run if @noble/ed25519 is installed
if (ed25519Available) {
  describe("Ed25519 real crypto (requires @noble/ed25519)", () => {
    // Generate a deterministic test key
    const testPrivateKey = "0x" + "01".repeat(32);

    it("round-trip sign and verify", async () => {
      const signer = new Ed25519Signer(testPrivateKey);
      const verifier = new Ed25519Verifier();

      const content = {
        workflow: "ed25519-test",
        task: "verify-round-trip",
        agentRole: "test-agent",
        outputType: "test-result",
      };

      const block = await createSignedBlock(content, [], signer);

      assert.ok(block.attestation);
      assert.equal(block.attestation.algorithm, "ed25519");
      assert.ok(block.attestation.attester.startsWith("0x"));
      assert.ok(block.attestation.signature.startsWith("0x"));

      const result = await validateSignedBlock(block, verifier);
      assert.ok(result.ok, "Signed block should validate");
      assert.equal(result.attestation.ok, true);
      assert.equal(result.attestation.algorithm, "ed25519");
    });

    it("detects tampered signature", async () => {
      const signer = new Ed25519Signer(testPrivateKey);
      const verifier = new Ed25519Verifier();

      const block = await createSignedBlock({ task: "tamper-test" }, [], signer);

      // Flip one byte in the signature
      const sigBytes = block.attestation.signature;
      const tampered = sigBytes.slice(0, -2) + "ff";
      block.attestation.signature = tampered;

      const result = await validateSignedBlock(block, verifier);
      assert.equal(result.attestation.ok, false);
    });

    it("produces deterministic signatures for same input", async () => {
      const signer = new Ed25519Signer(testPrivateKey);

      const block1 = await createSignedBlock({ task: "determinism" }, [], signer);
      const block2 = await createSignedBlock({ task: "determinism" }, [], signer);

      // Same blockHash (content-addressed)
      assert.equal(block1.block.blockHash, block2.block.blockHash);
      // Same attester (same key)
      assert.equal(block1.attestation.attester, block2.attestation.attester);
      // Ed25519 signatures ARE deterministic (unlike ECDSA)
      assert.equal(block1.attestation.signature, block2.attestation.signature);
    });

    it("different keys produce different attestations for same block", async () => {
      const signer1 = new Ed25519Signer("0x" + "01".repeat(32));
      const signer2 = new Ed25519Signer("0x" + "02".repeat(32));

      const block1 = await createSignedBlock({ task: "multi-key" }, [], signer1);
      const block2 = await createSignedBlock({ task: "multi-key" }, [], signer2);

      assert.equal(block1.block.blockHash, block2.block.blockHash); // Same content = same hash
      assert.notEqual(block1.attestation.attester, block2.attestation.attester); // Different keys
      assert.notEqual(block1.attestation.signature, block2.attestation.signature);
    });
  });
} else {
  describe("Ed25519 real crypto (SKIPPED — @noble/ed25519 not installed)", () => {
    it("install @noble/ed25519 to run full Ed25519 crypto tests", () => {
      console.log("  Skipped: npm install @noble/ed25519 to enable");
      assert.ok(true);
    });
  });
}
