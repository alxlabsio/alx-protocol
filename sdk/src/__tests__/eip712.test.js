import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Wallet } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = (name) => pathToFileURL(resolve(__dirname, "../../dist", name)).href;

const { Eip712Signer, Eip712Verifier } = await import(dist("eip712.js"));

describe("EIP-712 recovery", () => {
  it("round-trips a fixed Block hash with the installed recovery backend", async () => {
    const wallet = new Wallet(`0x${"01".repeat(32)}`);
    const options = { chainId: 8453, timestamp: 1_700_000_000 };
    const signer = new Eip712Signer(wallet, options);
    const verifier = new Eip712Verifier(options);
    const blockHashBytes = new Uint8Array(32).fill(0x2a);
    const expectedSigner = await signer.getId();

    const signature = await signer.sign(blockHashBytes);
    const result = await verifier.verify(blockHashBytes, signature, expectedSigner);

    assert.deepEqual(result, { ok: true, signer: expectedSigner });
  });
});
