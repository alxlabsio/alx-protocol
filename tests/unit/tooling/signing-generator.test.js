import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { runSigningVectorGenerator } from "../../../scripts/protocol/regenerate-signing-vectors.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const vectorPaths = [
  "protocol/extensions/signing/test-vectors/signed-blocks.json",
  "protocol/extensions/signing/test-vectors/ed25519-attestations.json",
  "protocol/extensions/signing/test-vectors/p256-attestations.json",
];

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "alx-signing-generator-"));
  for (const relativePath of vectorPaths) {
    const destination = join(root, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(repositoryRoot, relativePath), destination);
  }
  return root;
}

test("signing generator check is non-mutating and write repairs stale output", async () => {
  const root = fixtureRoot();
  try {
    await runSigningVectorGenerator({ mode: "check", root });
    const target = join(root, vectorPaths[1]);
    const document = JSON.parse(readFileSync(target, "utf8"));
    document.vectors.find((vector) => vector.id === "ED25519-1").input.attestation.signature = "0x00";
    writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    const staleSource = readFileSync(target, "utf8");

    await assert.rejects(
      runSigningVectorGenerator({ mode: "check", root }),
      /Stale signing vectors/,
    );
    assert.equal(readFileSync(target, "utf8"), staleSource);

    const result = await runSigningVectorGenerator({ mode: "write", root });
    assert.equal(result.updated, 1);
    await runSigningVectorGenerator({ mode: "check", root });
    assert.doesNotMatch(readFileSync(target, "utf8"), /\.tmp-|\.bak-/);
    assert.equal(
      readdirSync(dirname(target)).some((name) => name.includes(".tmp-") || name.includes(".bak-")),
      false,
    );
  } finally {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

test("signing generator fails closed on malformed vector JSON", async () => {
  const root = fixtureRoot();
  try {
    writeFileSync(join(root, vectorPaths[2]), "{ malformed", "utf8");
    await assert.rejects(
      runSigningVectorGenerator({ mode: "check", root }),
      /invalid vector JSON/,
    );
  } finally {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});
