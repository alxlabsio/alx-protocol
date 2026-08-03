import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { REPO_ROOT } from "../lib/cli-context.js";
import { die } from "../lib/cli-utils.js";

export async function cmdTestVectors(args) {
  if (args[0] !== "run") die("Usage: alx test-vectors run");
  return cmdConformance(["run", "--self-test"]);
}

export async function cmdConformance(args) {
  if (args[0] !== "run") die("Usage: alx conformance run [--impl <command>]");

  const conformancePath = resolve(REPO_ROOT, "conformance/bin/run.js");
  if (!existsSync(conformancePath)) die("conformance runner not found.");

  // Forward args to conformance runner
  const { execFileSync } = await import("node:child_process");
  const implIdx = args.indexOf("--impl");
  const runArgs = [];

  if (implIdx !== -1 && args[implIdx + 1]) {
    runArgs.push("--impl", args[implIdx + 1]);
  } else {
    runArgs.push("--self-test");
  }

  try {
    execFileSync(process.execPath, [conformancePath, ...runArgs], {
      stdio: "inherit",
    });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

export async function cmdExtensionConformance(args) {
  const extension = args[0];
  if (!["merkle", "signing"].includes(extension))
    die("Usage: alx extension-conformance <merkle|signing> [--impl <command>]");

  const runnerPath = resolve(
    REPO_ROOT,
    `conformance/bin/run-${extension}-extension.js`,
  );
  if (!existsSync(runnerPath))
    die(`${extension} extension conformance runner not found.`);

  const { execFileSync } = await import("node:child_process");
  const implIdx = args.indexOf("--impl");
  const runArgs = [];
  if (implIdx !== -1 && args[implIdx + 1])
    runArgs.push("--impl", args[implIdx + 1]);

  try {
    execFileSync(process.execPath, [runnerPath, ...runArgs], {
      stdio: "inherit",
    });
  } catch (e) {
    process.exit(e.status || 1);
  }
}
