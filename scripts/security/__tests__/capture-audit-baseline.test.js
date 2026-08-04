import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateFileEntries,
  captureSurface,
  parseArgs,
  sha256,
} from "../capture-audit-baseline.mjs";

describe("security audit baseline capture", () => {
  it("builds an order-independent aggregate from sorted file entries", () => {
    const entries = [
      { path: "protocol/spec.md", sha256: sha256("spec") },
      { path: "protocol/VERSION", sha256: sha256("1") },
    ];
    assert.equal(
      aggregateFileEntries(entries),
      aggregateFileEntries(entries.toReversed()),
    );
  });

  it("changes the aggregate when audited bytes change", () => {
    const original = [{ path: "protocol/spec.md", sha256: sha256("original") }];
    const changed = [{ path: "protocol/spec.md", sha256: sha256("changed") }];
    assert.notEqual(
      aggregateFileEntries(original),
      aggregateFileEntries(changed),
    );
  });

  it("accepts the package-manager argument separator", () => {
    assert.deepEqual(parseArgs(["--", "--output", "baseline.json"]), {
      output: "baseline.json",
    });
  });

  it("captures tracked canonical protocol files", () => {
    const surface = captureSurface({
      id: "protocol-version",
      paths: ["protocol/VERSION"],
    });
    assert.equal(surface.id, "protocol-version");
    assert.equal(surface.fileCount, 1);
    assert.equal(surface.files[0].path, "protocol/VERSION");
    assert.match(surface.aggregateSha256, /^[a-f0-9]{64}$/);
  });
});
