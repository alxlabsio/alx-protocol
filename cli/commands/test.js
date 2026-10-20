import { resolve } from "node:path";

import { ALX_VERSION, validateBlock } from "../lib/cli-context.js";
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

/**
 * Strip a narrow subset of TypeScript annotations from a validatePassword function
 * so it can be evaluated as plain JavaScript.
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

  const testsResult = validateBlock(testsBlock);
  const validatorResult = validateBlock(validatorBlock);
  if (!testsResult.ok)
    die("Tests Block seal is broken — run alx block verify on the tests Block");
  if (!validatorResult.ok)
    die(
      "Validator Block seal is broken — run alx block verify on the validator Block",
    );

  const { createRequire } = await import("node:module");
  const { tmpdir } = await import("node:os");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const tmpFile = resolve(tmpdir(), `alx_test_${Date.now()}.js`);
  const js = stripTypeAnnotations(validatorBlock.content.code);

  writeFileSync(tmpFile, js + "\nmodule.exports = { validatePassword };");

  let validatePassword;
  try {
    const req = createRequire(import.meta.url);
    validatePassword = req(tmpFile).validatePassword;
  } catch (error) {
    die(`Could not execute validator code: ${error.message}`);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* The operating-system temporary directory handles cleanup. */
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

  let passed = 0;
  let failed = 0;
  for (const testCase of testsBlock.content.cases) {
    let result;
    try {
      result = validatePassword(testCase.input);
    } catch (error) {
      result = { ok: false, errors: [`runtime error: ${error.message}`] };
    }

    const pass = result.ok === testCase.expectedOk;
    if (pass) passed += 1;
    else failed += 1;

    const symbol = pass ? green("✓") : red("✗");
    const expectedLabel = testCase.expectedOk ? "accepted" : "rejected";
    console.log(
      `  ${symbol}  ${JSON.stringify(testCase.input).padEnd(36)} ${dim(expectedLabel)}`,
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
