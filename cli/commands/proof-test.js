import { resolve } from "node:path";

import {
  ALX_VERSION,
  canonicalizeProtocolJson,
  deriveBlockHash,
  deriveContentHash,
  validateBlock,
} from "../lib/cli-context.js";
import {
  bold,
  die,
  dim,
  fail,
  green,
  ok,
  parseJson,
  readInput,
  red,
} from "../lib/cli-utils.js";

export function cmdProof(args) {
  const filePath = args[0];
  if (!filePath || filePath.startsWith("--"))
    die("Usage: alx proof <block.json>");

  const input = readInput(filePath);
  const block = parseJson(input);

  if (!block.blockHash)
    die(
      "Input must be a Block object with blockHash, content, and parentHashes",
    );

  const rawParents = block.parentHashes || [];
  const sortedParents = [
    ...new Set(
      rawParents
        .map((h) => String(h).trim().toLowerCase())
        .filter((h) => /^0x[a-f0-9]{64}$/.test(h)),
    ),
  ].sort();

  const contentCanon = canonicalizeProtocolJson(block.content ?? null);
  const blockInput = canonicalizeProtocolJson({
    content: block.content ?? null,
    parentHashes: sortedParents,
  });
  const recomputedContentHash = deriveContentHash(block.content);
  const recomputedBlockHash = deriveBlockHash(block.content, rawParents);
  const storedBlockHash = String(block.blockHash).trim().toLowerCase();
  const valid = recomputedBlockHash === storedBlockHash;

  const contentType =
    block.content && typeof block.content === "object" && block.content.type
      ? String(block.content.type)
      : null;

  const TRUNC = 120;
  const truncate = (s) =>
    s.length > TRUNC
      ? s.slice(0, TRUNC) + dim(`…(${s.length} bytes total)`)
      : `${s} ${dim(`(${s.length} bytes)`)}`;

  console.log(`\n${bold("Block Proof")}  ${dim(filePath)}\n`);

  // ── Layer 1: Content identity ──
  console.log(`  ${bold("── Content identity ──")}`);
  if (contentType) console.log(`  content type   ${dim(contentType)}`);
  console.log(`  contentHash    ${block.contentHash || dim("(not stored)")}`);
  console.log(`  canonical      ${truncate(contentCanon)}`);
  console.log(
    `                 ${dim(`keccak-256 →`)} ${recomputedContentHash}`,
  );
  if (block.contentHash) {
    const chMatch =
      recomputedContentHash === String(block.contentHash).trim().toLowerCase();
    console.log(
      `                 ${chMatch ? green("✓ matches stored contentHash") : red("✗ stored contentHash does not match")}`,
    );
  }
  console.log();

  // ── Layer 2: Block identity ──
  console.log(`  ${bold("── Block identity ──")}`);
  if (rawParents.length === 0) {
    console.log(`  Parents        ${dim("(none — this is a root block)")}`);
  } else {
    console.log(
      `  Parents (raw)  ${rawParents.length} hash${rawParents.length === 1 ? "" : "es"}`,
    );
    for (const p of rawParents)
      console.log(`                   ${dim(p.slice(0, 18))}...`);
    if (
      JSON.stringify(rawParents.map((h) => h.toLowerCase())) !==
      JSON.stringify(sortedParents)
    ) {
      console.log(
        `  After sort     ${sortedParents.map((h) => h.slice(0, 18) + "...").join(", ")}  ${dim("(lexicographic)")}`,
      );
    } else {
      console.log(`  After sort     ${dim("already sorted")}`);
    }
    if (sortedParents.length < rawParents.length) {
      console.log(
        `  After dedup    ${sortedParents.length} unique  ${dim(`(${rawParents.length - sortedParents.length} duplicate(s) removed)`)}`,
      );
    } else {
      console.log(
        `  After dedup    ${sortedParents.length} unique  ${dim("(no duplicates)")}`,
      );
    }
  }
  console.log(`  Hash input     ${truncate(blockInput)}`);
  console.log(`                 ${dim(`keccak-256 →`)} ${recomputedBlockHash}`);
  console.log(`  blockHash      ${block.blockHash}`);
  console.log();

  // ── Layer 3: Integrity check ──
  console.log(`  ${bold("── Integrity check ──")}`);
  console.log(`  Recomputed     ${recomputedBlockHash}`);
  console.log(`  Stored         ${storedBlockHash}`);
  if (valid) {
    console.log(
      `  Result         ${green("✓ VALID — recomputed hash matches stored hash")}`,
    );
  } else {
    console.log(
      `  Result         ${red("✗ INVALID — recomputed hash differs from stored hash")}`,
    );
    console.log(
      `  ${dim("The content or parentHashes have been modified after this block was created.")}`,
    );
  }
  console.log();

  // ── Anti-tamper note ──
  console.log(`  ${bold("── Anti-tamper ──")}`);
  console.log(
    `  Any change to ${bold("content")} or ${bold("parentHashes")} produces a different blockHash.`,
  );
  console.log(
    `  ${dim("alx block verify")} recomputes from scratch — the stored blockHash is never trusted.`,
  );
  if (contentType && contentType.includes("policy")) {
    console.log(
      `  ${dim("Example: change content.rules.minLength → blockHash changes → validation fails.")}`,
    );
  } else if (contentType && contentType.includes("validator")) {
    console.log(
      `  ${dim("Example: change any line of content.code → blockHash changes → validation fails.")}`,
    );
  } else {
    console.log(
      `  ${dim("Example: add, remove, or edit any field in content → blockHash changes → validation fails.")}`,
    );
  }
  console.log();
}

/**
 * Strip a narrow subset of TypeScript annotations from a validatePassword function
 * so it can be eval-ed as plain JavaScript.
 *
 * Handles only the specific patterns expected by the locked validator contract:
 * the export keyword, the (password: string) parameter type, the return type
 * annotation, and const errors: string[] declarations.
 * It is not a general-purpose TypeScript stripper.
 */

function stripTypeAnnotations(tsCode) {
  return tsCode
    .replace(
      /export\s+function\s+validatePassword/,
      "function validatePassword",
    )
    .replace(/\(password:\s*string\)/, "(password)")
    .replace(
      /\):\s*\{\s*ok:\s*boolean;\s*errors:\s*string\[\]\s*\}\s*\{/,
      ") {",
    )
    .replace(/const\s+errors:\s*string\[\]/, "const errors");
}

export async function cmdTestRouter(args) {
  if (args[0] !== "run") {
    die(
      "Usage: alx test run <tests-block.json> --against <validator-block.json>",
    );
  }
  return cmdTest(args.slice(1));
}

async function cmdTest(args) {
  const testsFile = args[0];
  const againstIdx = args.indexOf("--against");
  const validatorFile = againstIdx !== -1 ? args[againstIdx + 1] : null;

  if (!testsFile || !validatorFile) {
    die(
      "Usage: alx test run <tests-block.json> --against <validator-block.json>",
    );
  }

  const testsBlock = parseJson(readInput(testsFile));
  const validatorBlock = parseJson(readInput(validatorFile));

  if (!testsBlock.content?.cases)
    die("Tests block must have content.cases array");
  if (!validatorBlock.content?.code)
    die("Validator block must have content.code string");

  // Verify seals before running — refuse to test tampered blocks
  const tv = validateBlock(testsBlock);
  const vv = validateBlock(validatorBlock);
  if (!tv.ok)
    die(`Tests Block seal is broken — run alx block verify on the tests Block`);
  if (!vv.ok)
    die(
      `Validator Block seal is broken — run alx block verify on the validator Block`,
    );

  // Strip TypeScript type annotations, write to a temp CJS file, load via createRequire
  const { createRequire } = await import("node:module");
  const { tmpdir } = await import("node:os");
  const { writeFileSync: wfs, unlinkSync } = await import("node:fs");
  const tmpFile = resolve(tmpdir(), `alx_test_${Date.now()}.js`);

  const js = stripTypeAnnotations(validatorBlock.content.code);

  wfs(tmpFile, js + "\nmodule.exports = { validatePassword };");

  let validatePassword;
  try {
    const req = createRequire(import.meta.url);
    validatePassword = req(tmpFile).validatePassword;
  } catch (e) {
    die(`Could not execute validator code: ${e.message}`);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* non-fatal: OS temp dir handles cleanup */
    }
  }

  if (typeof validatePassword !== "function")
    die("Validator block does not export validatePassword");

  console.log(`\n${bold("ALX Test Runner")}\n`);
  console.log(
    `  ${bold("Tests")}      ${testsBlock.blockHash.slice(0, 18)}...  ${dim("[" + (testsBlock.content.type ?? "tests") + "]")}`,
  );
  console.log(
    `  ${bold("Validator")}  ${validatorBlock.blockHash.slice(0, 18)}...  ${dim("[" + (validatorBlock.content.type ?? "validator") + "]")}`,
  );
  console.log();

  let passed = 0,
    failed = 0;
  for (const c of testsBlock.content.cases) {
    let result;
    try {
      result = validatePassword(c.input);
    } catch (e) {
      result = { ok: false, errors: [`runtime error: ${e.message}`] };
    }

    const pass = result.ok === c.expectedOk;
    pass ? passed++ : failed++;

    const sym = pass ? green("\u2713") : red("\u2717");
    const expectedLabel = c.expectedOk ? "accepted" : "rejected";
    console.log(
      `  ${sym}  ${JSON.stringify(c.input).padEnd(36)} ${dim(expectedLabel)}`,
    );
    if (!pass) {
      const actualLabel = result.ok ? "accepted" : "rejected";
      console.log(
        `       expected=${expectedLabel}  got=${actualLabel}  errors=${JSON.stringify(result.errors ?? [])}`,
      );
    }
  }

  console.log();
  if (failed === 0) {
    ok(
      `${passed}/${passed + failed} cases passed — locked validator satisfies locked test spec`,
    );
    ok(dim(`alx-protocol TypeScript v${ALX_VERSION}`));
  } else {
    fail(
      `${failed}/${passed + failed} cases failed — validator does not satisfy locked test spec`,
    );
  }
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}
