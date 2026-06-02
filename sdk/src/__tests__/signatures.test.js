import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function dist(name) { return pathToFileURL(resolve(__dirname, "../../dist", name)).href; }

const {
  createBlock,
  createSignedBlock,
  addAttestation,
  validateBlock,
  validateSignedBlock,
  buildGraph,
  validateGraph,
  traceAttribution,
} = await import(dist("index.js"));

const core = (signedBlock) => signedBlock.block;

// ── Mock signers (algorithm-agnostic, no ethers dependency) ──
// Content is realistic application-layer data.
// The protocol does not inspect domain semantics.
// Identity is derived from canonical content + lineage.

function createMockSigner(id, algorithm = "mock-hmac") {
  return {
    algorithm,
    getId: async () => id,
    sign: async (data) => {
      const hex = Array.from(data).map(b => b.toString(16).padStart(2, "0")).join("");
      return `mock:${id}:${hex}`;
    },
  };
}

function createMockVerifier(algorithm = "mock-hmac") {
  return {
    algorithm,
    verify: async (data, signature, expectedSigner) => {
      const parts = signature.split(":");
      if (parts.length < 3 || parts[0] !== "mock") return { ok: false, signer: "" };
      const signerId = parts[1];
      const hexData = parts.slice(2).join(":");
      const expectedHex = Array.from(data).map(b => b.toString(16).padStart(2, "0")).join("");
      return {
        ok: hexData === expectedHex && (!expectedSigner || signerId === expectedSigner),
        signer: signerId,
      };
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Scenario 1: Multi-Agent Research Pipeline
// Proves: deterministic identity, lineage-sensitive blockHash, stable
//         contentHash, pathCount reflects multi-source contribution.
// ══════════════════════════════════════════════════════════════════════════

const marketResearchContent = {
  workflow: "multi-agent-research",
  task: "evaluate-gpu-infrastructure-demand",
  agentRole: "research-agent",
  findings: [
    { claim: "GPU demand remains elevated due to AI training and inference workloads.", evidenceType: "market-signal", confidence: 0.86 },
    { claim: "Enterprise inference workloads are becoming a larger share of accelerator demand.", evidenceType: "adoption-pattern", confidence: 0.79 },
  ],
  sourcesReviewed: 8,
  outputType: "research-brief",
};

const analysisContent = {
  workflow: "multi-agent-research",
  task: "analyze-gpu-infrastructure-demand",
  agentRole: "analysis-agent",
  dependsOn: ["market-research"],
  conclusion: "Demand is likely to remain structurally strong, but supply constraints and margin pressure create execution risk.",
  riskFactors: ["supply-chain constraints", "customer concentration", "pricing compression", "regulatory restrictions"],
  confidence: 0.81,
  outputType: "investment-analysis",
};

const decisionContent = {
  workflow: "multi-agent-research",
  task: "produce-investment-thesis",
  agentRole: "decision-agent",
  recommendation: "monitor",
  rationale: "The opportunity is strong, but risk-adjusted timing requires further validation.",
  requiredFollowUps: ["compare revenue growth against capex expansion", "review customer concentration", "track inference margin trends"],
  outputType: "decision-memo",
};

describe("Scenario 1: Multi-Agent Research Pipeline", () => {
  it("research block has deterministic identity", () => {
    const a = createBlock(marketResearchContent);
    const b = createBlock(marketResearchContent);
    assert.equal(a.blockHash, b.blockHash);
    assert.equal(a.contentHash, b.contentHash);
  });

  it("analysis block depends on research — different parents change blockHash", () => {
    const researchBlock = createBlock(marketResearchContent);
    const analysisWithParent = createBlock(analysisContent, [researchBlock.blockHash]);
    const analysisWithoutParent = createBlock(analysisContent);

    assert.notEqual(analysisWithParent.blockHash, analysisWithoutParent.blockHash);
    assert.equal(analysisWithParent.contentHash, analysisWithoutParent.contentHash);
  });

  it("decision block merges research + analysis — lineage is traceable", () => {
    const researchBlock = createBlock(marketResearchContent);
    const analysisBlock = createBlock(analysisContent, [researchBlock.blockHash]);
    const decisionBlock = createBlock(decisionContent, [researchBlock.blockHash, analysisBlock.blockHash]);

    const graph = buildGraph([researchBlock, analysisBlock, decisionBlock]);
    const graphResult = validateGraph(graph);
    assert.ok(graphResult.ok);
    assert.equal(graphResult.blocks, 3);
    assert.equal(graphResult.edges, 3);

    const trace = traceAttribution(decisionBlock.blockHash, graph);
    assert.equal(trace.nodes.length, 3);
    assert.equal(trace.leaves.length, 1);
    assert.equal(trace.leaves[0], researchBlock.blockHash);

    // Research is reachable via 2 paths: decision->research and decision->analysis->research
    const researchNode = trace.nodes.find(n => n.hash === researchBlock.blockHash);
    assert.equal(researchNode.pathCount, 2);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Scenario 2: Compliance Audit Trail
// Proves: signed blocks are verifiable, tampered content fails validation,
//         review and approval are separate lineage steps, attestations
//         are separate from identity.
// ══════════════════════════════════════════════════════════════════════════

const generatedReportContent = {
  workflow: "compliance-audit-trail",
  task: "generate-financial-risk-summary",
  agentRole: "report-generation-agent",
  reportType: "financial-risk-summary",
  summary: "The customer shows moderate liquidity risk due to increased debt obligations and uneven cash flow.",
  riskLevel: "medium",
  assumptions: [
    "cash flow data is current as of report generation",
    "no undisclosed liabilities are present",
    "credit exposure remains within policy limits",
  ],
  requiredReview: true,
  outputType: "draft-report",
};

const complianceReviewContent = {
  workflow: "compliance-audit-trail",
  task: "review-financial-risk-summary",
  agentRole: "compliance-review-agent",
  reviewStatus: "changes-required",
  findings: [
    { issue: "Risk summary lacks explicit source references.", severity: "medium", requiredAction: "attach source evidence for each material claim" },
    { issue: "Confidence score missing from final recommendation.", severity: "low", requiredAction: "include confidence score before approval" },
  ],
  outputType: "compliance-review",
};

const approvalContent = {
  workflow: "compliance-audit-trail",
  task: "approve-reviewed-report",
  agentRole: "approval-agent",
  approvalStatus: "approved-with-conditions",
  conditions: [
    "source references must remain attached",
    "material claims must remain traceable to reviewed evidence",
  ],
  signedOffBy: "approval-agent",
  outputType: "approval-record",
};

describe("Scenario 2: Compliance Audit Trail", () => {
  it("three-step audit chain validates end-to-end", async () => {
    const reportSigner = createMockSigner("report-generation-agent");
    const reviewSigner = createMockSigner("compliance-review-agent");
    const approvalSigner = createMockSigner("approval-agent");

    const reportBlock = await createSignedBlock(generatedReportContent, [], reportSigner);
    const reviewBlock = await createSignedBlock(complianceReviewContent, [core(reportBlock).blockHash], reviewSigner);
    const approvalBlock = await createSignedBlock(approvalContent, [core(reviewBlock).blockHash], approvalSigner);

    // All three blocks have attestations with correct identities
    assert.equal(reportBlock.attestation.attester, "report-generation-agent");
    assert.equal(reviewBlock.attestation.attester, "compliance-review-agent");
    assert.equal(approvalBlock.attestation.attester, "approval-agent");

    // Graph is structurally valid
    const graph = buildGraph([core(reportBlock), core(reviewBlock), core(approvalBlock)]);
    assert.ok(validateGraph(graph).ok);
  });

  it("tampered report content fails validation", async () => {
    const signer = createMockSigner("report-generation-agent");
    const reportBlock = await createSignedBlock(generatedReportContent, [], signer);

    // Retroactive tampering: change risk level
    core(reportBlock).content = { ...generatedReportContent, riskLevel: "low", summary: "TAMPERED: no risk detected" };

    const hashResult = validateBlock(core(reportBlock));
    assert.equal(hashResult.ok, false);
  });

  it("attestation is separate from block identity", async () => {
    const signer = createMockSigner("report-generation-agent");
    const signedReport = await createSignedBlock(generatedReportContent, [], signer);
    const unsignedReport = createBlock(generatedReportContent);

    // Same blockHash regardless of signing
    assert.equal(core(signedReport).blockHash, unsignedReport.blockHash);
    assert.equal(core(signedReport).contentHash, unsignedReport.contentHash);
    // But only the signed one has attestation
    assert.ok(signedReport.attestation);
    assert.equal(unsignedReport.attestation, undefined);
  });

  it("signature verification catches wrong attester", async () => {
    const signer = createMockSigner("compliance-review-agent");
    const verifier = createMockVerifier();
    const reviewBlock = await createSignedBlock(complianceReviewContent, [], signer);

    // Tamper: change the attester claim without re-signing
    reviewBlock.attestation.attester = "unauthorized-agent";

    const result = await validateSignedBlock(reviewBlock, verifier);
    assert.equal(result.attestation.ok, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Scenario 3: Multi-Vendor Agent Marketplace
// Proves: different providers contribute to one lineage graph, vendor
//         identity/signature is separate from block identity, protocol
//         interoperability does not depend on vendor runtime.
// ══════════════════════════════════════════════════════════════════════════

const plannerContent = {
  workflow: "multi-vendor-agent-marketplace",
  task: "plan-saas-security-review",
  provider: "openai",
  agentRole: "planning-agent",
  plan: [
    "review authentication boundaries",
    "inspect authorization checks",
    "validate billing webhook handling",
    "check tenant isolation",
    "review audit logging",
  ],
  outputType: "security-review-plan",
};

const reviewerContent = {
  workflow: "multi-vendor-agent-marketplace",
  task: "review-saas-security-plan",
  provider: "anthropic",
  agentRole: "review-agent",
  review: {
    strengths: ["covers critical SaaS control points", "includes billing and tenant-isolation risks"],
    gaps: ["missing rate-limit abuse testing", "missing incident-response validation", "missing secret-rotation review"],
  },
  outputType: "security-plan-review",
};

const executorContent = {
  workflow: "multi-vendor-agent-marketplace",
  task: "execute-saas-security-checklist",
  provider: "open-source-runtime",
  agentRole: "execution-agent",
  completedChecks: [
    "auth-session-expiration",
    "rbac-route-protection",
    "webhook-signature-verification",
    "tenant-data-access-boundaries",
  ],
  failedChecks: [
    { check: "rate-limit-abuse-testing", reason: "no rate-limit policy found for public API routes" },
  ],
  outputType: "execution-report",
};

describe("Scenario 3: Multi-Vendor Agent Marketplace", () => {
  it("three vendors contribute to one lineage graph", async () => {
    // Each vendor uses a different signing algorithm
    const openaiSigner = createMockSigner("openai-platform", "ecdsa-secp256k1");
    const anthropicSigner = createMockSigner("anthropic-platform", "ed25519");
    const ossSigner = createMockSigner("oss-runtime", "mock-hmac");

    const planBlock = await createSignedBlock(plannerContent, [], openaiSigner);
    const reviewBlock = await createSignedBlock(reviewerContent, [core(planBlock).blockHash], anthropicSigner);
    const execBlock = await createSignedBlock(executorContent, [core(reviewBlock).blockHash], ossSigner);

    // Each block carries its vendor's algorithm
    assert.equal(planBlock.attestation.algorithm, "ecdsa-secp256k1");
    assert.equal(reviewBlock.attestation.algorithm, "ed25519");
    assert.equal(execBlock.attestation.algorithm, "mock-hmac");

    // Each block carries its vendor's identity
    assert.equal(planBlock.attestation.attester, "openai-platform");
    assert.equal(reviewBlock.attestation.attester, "anthropic-platform");
    assert.equal(execBlock.attestation.attester, "oss-runtime");

    // The graph validates — protocol doesn't care about vendor/algorithm
    const graph = buildGraph([core(planBlock), core(reviewBlock), core(execBlock)]);
    const graphResult = validateGraph(graph);
    assert.ok(graphResult.ok);
    assert.equal(graphResult.blocks, 3);
  });

  it("vendor identity is separate from block identity", async () => {
    const signer1 = createMockSigner("vendor-a", "ecdsa-secp256k1");
    const signer2 = createMockSigner("vendor-b", "ed25519");

    // Same content, same parents, different signers
    const block1 = await createSignedBlock(plannerContent, [], signer1);
    const block2 = await createSignedBlock(plannerContent, [], signer2);

    // Identical block identity (content-addressed, deterministic)
    assert.equal(core(block1).blockHash, core(block2).blockHash);
    assert.equal(core(block1).contentHash, core(block2).contentHash);

    // Different attestations (vendor-specific)
    assert.notEqual(block1.attestation.attester, block2.attestation.attester);
    assert.notEqual(block1.attestation.algorithm, block2.attestation.algorithm);
    assert.notEqual(block1.attestation.signature, block2.attestation.signature);
  });

  it("each vendor's attestation is independently verifiable", async () => {
    const signer = createMockSigner("anthropic-platform", "ed25519");
    const verifier = createMockVerifier("ed25519");
    const block = await createSignedBlock(reviewerContent, [], signer);

    const result = await validateSignedBlock(block, verifier);
    assert.ok(result.ok);
    assert.equal(result.attestation.ok, true);
    assert.equal(result.attestation.attester, "anthropic-platform");
    assert.equal(result.attestation.algorithm, "ed25519");
  });

  it("cross-vendor attribution trace works across the full pipeline", async () => {
    const planBlock = await createSignedBlock(plannerContent, [], createMockSigner("openai", "ecdsa"));
    const reviewBlock = await createSignedBlock(reviewerContent, [core(planBlock).blockHash], createMockSigner("anthropic", "ed25519"));
    const execBlock = await createSignedBlock(executorContent, [core(reviewBlock).blockHash], createMockSigner("oss", "hmac"));

    const graph = buildGraph([core(planBlock), core(reviewBlock), core(execBlock)]);
    const trace = traceAttribution(core(execBlock).blockHash, graph);

    assert.equal(trace.nodes.length, 3);
    assert.equal(trace.maxDepth, 2);
    assert.equal(trace.leaves.length, 1);
    assert.equal(trace.leaves[0], core(planBlock).blockHash);

    // Each node is reachable — lineage is intact across vendors
    for (const node of trace.nodes) {
      assert.ok(node.pathCount >= 1);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Regression: unsigned blocks and basic validation
// ══════════════════════════════════════════════════════════════════════════

describe("unsigned block regression", () => {
  it("createBlock works without signer (synchronous)", () => {
    const block = createBlock(marketResearchContent);
    assert.ok(block.blockHash);
    assert.ok(block.contentHash);
    assert.deepEqual(block.parentHashes, []);
    assert.equal(block.content.workflow, "multi-agent-research");
    assert.equal(block.attestation, undefined);
  });

  it("validateBlock works without verifier (synchronous)", () => {
    const block = createBlock(complianceReviewContent);
    const result = validateBlock(block);
    assert.ok(result.ok);
    assert.equal(result.attestation, undefined);
  });

  it("validateBlock detects tampering without verifier", () => {
    const block = createBlock(generatedReportContent);
    block.content = { ...generatedReportContent, riskLevel: "low" };
    const result = validateBlock(block);
    assert.equal(result.ok, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Input validation hardening
// ══════════════════════════════════════════════════════════════════════════

describe("attestation input validation", () => {
  it("rejects negative timestamp", async () => {
    const signer = createMockSigner("agent");
    await assert.rejects(
      () => createSignedBlock(marketResearchContent, [], signer, -1),
      { message: /timestamp must be a non-negative safe integer/ },
    );
  });

  it("rejects NaN timestamp", async () => {
    const signer = createMockSigner("agent");
    await assert.rejects(
      () => createSignedBlock(marketResearchContent, [], signer, NaN),
      { message: /timestamp must be a non-negative safe integer/ },
    );
  });

  it("rejects Infinity timestamp", async () => {
    const signer = createMockSigner("agent");
    await assert.rejects(
      () => createSignedBlock(marketResearchContent, [], signer, Infinity),
      { message: /timestamp must be a non-negative safe integer/ },
    );
  });

  it("rejects empty algorithm string", async () => {
    const signer = createMockSigner("agent", "");
    await assert.rejects(
      () => createSignedBlock(marketResearchContent, [], signer),
      { message: /signer\.algorithm must be a non-empty string/ },
    );
  });

  it("detects attestation.blockHash mismatch", async () => {
    const signer = createMockSigner("agent");
    const verifier = createMockVerifier();
    const block = await createSignedBlock(marketResearchContent, [], signer);

    // Tamper: swap the attestation's blockHash
    block.attestations[0].blockHash = "0x" + "f".repeat(64);
    block.attestation.blockHash = "0x" + "f".repeat(64);

    const result = await validateSignedBlock(block, verifier);
    assert.equal(result.ok, false);
    assert.equal(result.attestation.ok, false);
    assert.ok(result.attestation.reason.includes("does not match"));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Multi-attestation support
// ══════════════════════════════════════════════════════════════════════════

describe("multiple attestations per block", () => {
  it("addAttestation appends a second signer to an existing block", async () => {
    const signer1 = createMockSigner("research-agent", "mock-hmac");
    const signer2 = createMockSigner("compliance-reviewer", "mock-hmac");

    let block = await createSignedBlock(marketResearchContent, [], signer1);
    assert.equal(block.attestations.length, 1);

    block = await addAttestation(block, signer2);
    assert.equal(block.attestations.length, 2);
    assert.equal(block.attestations[0].attester, "research-agent");
    assert.equal(block.attestations[1].attester, "compliance-reviewer");

    // blockHash unchanged
    assert.ok(validateBlock(core(block)).ok);
  });

  it("three vendors attest the same block with different algorithms", async () => {
    const openaiSigner = createMockSigner("openai-platform", "ecdsa-secp256k1");
    const anthropicSigner = createMockSigner("anthropic-platform", "ed25519");
    const ossSigner = createMockSigner("oss-runtime", "mock-hmac");

    let block = await createSignedBlock(plannerContent, [], openaiSigner);
    block = await addAttestation(block, anthropicSigner);
    block = await addAttestation(block, ossSigner);

    assert.equal(block.attestations.length, 3);
    assert.equal(block.attestations[0].algorithm, "ecdsa-secp256k1");
    assert.equal(block.attestations[1].algorithm, "ed25519");
    assert.equal(block.attestations[2].algorithm, "mock-hmac");

    // All have the same blockHash
    for (const att of block.attestations) {
      assert.equal(att.blockHash, core(block).blockHash);
    }
  });

  it("validateSignedBlock with verifier map checks all attestations", async () => {
    const signer1 = createMockSigner("agent-a", "algo-1");
    const signer2 = createMockSigner("agent-b", "algo-2");

    let block = await createSignedBlock(marketResearchContent, [], signer1);
    block = await addAttestation(block, signer2);

    const verifiers = new Map([
      ["algo-1", createMockVerifier("algo-1")],
      ["algo-2", createMockVerifier("algo-2")],
    ]);

    const result = await validateSignedBlock(block, verifiers);
    assert.ok(result.ok);
    assert.equal(result.attestations.length, 2);
    assert.ok(result.attestations[0].ok);
    assert.ok(result.attestations[1].ok);
    assert.equal(result.attestations[0].attester, "agent-a");
    assert.equal(result.attestations[1].attester, "agent-b");
  });

  it("validateSignedBlock reports missing verifier for unknown algorithm", async () => {
    const signer = createMockSigner("agent", "unknown-algo");
    const block = await createSignedBlock(marketResearchContent, [], signer);

    const verifiers = new Map([
      ["mock-hmac", createMockVerifier("mock-hmac")],
    ]);

    const result = await validateSignedBlock(block, verifiers);
    assert.equal(result.ok, false);
    assert.equal(result.attestations[0].ok, false);
    assert.ok(result.attestations[0].reason.includes("no verifier"));
  });

  it("backwards compatible: singular attestation field still works", async () => {
    const signer = createMockSigner("agent");
    const verifier = createMockVerifier();
    const block = await createSignedBlock(marketResearchContent, [], signer);

    // Both fields populated
    assert.ok(block.attestation);
    assert.ok(block.attestations);
    assert.equal(block.attestation.attester, block.attestations[0].attester);

    // Single verifier still works (not a Map)
    const result = await validateSignedBlock(block, verifier);
    assert.ok(result.ok);
    assert.ok(result.attestation.ok);
  });
});
