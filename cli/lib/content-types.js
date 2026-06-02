/**
 * Canonical content type schemas for ALX Protocol blocks.
 *
 * These are advisory — the protocol never enforces content shape.
 * The CLI warns (does not error) when a known type is missing expected fields.
 */

export const CONTENT_TYPE_SCHEMAS = {
  "ai.prompt": {
    description: "An input prompt sent to an AI model",
    required: ["text"],
    optional: ["model", "systemPrompt", "temperature", "maxTokens", "metadata"],
  },
  "ai.response": {
    description: "A response received from an AI model",
    required: ["text"],
    optional: ["model", "promptTokens", "completionTokens", "stopReason", "metadata"],
  },
  "ai.artifact": {
    description: "A file or external resource produced by or referenced in an AI workflow",
    required: [],
    oneOf: [["cid"], ["url"], ["bucket", "key"]],
    optional: ["mimeType", "name", "size", "etag", "fetchedAt", "region", "metadata"],
  },
  "decision": {
    description: "A human or automated decision derived from prior blocks",
    required: ["text"],
    optional: ["rationale", "decidedBy", "decidedAt", "confidence", "metadata"],
  },
  "policy": {
    description: "A constraint or rule set that governs agent behaviour",
    required: ["rules"],
    optional: ["version", "issuer", "effectiveAt", "metadata"],
  },
  "ai.eval": {
    description: "An evaluation run result against a model or validator",
    required: ["cases"],
    optional: ["passed", "failed", "model", "evaluatedAt", "metadata"],
  },
  "context.handoff": {
    description: "Cross-agent or cross-vendor context transfer",
    required: ["fromAgent", "toAgent"],
    optional: ["summary", "state", "metadata"],
  },
};

/**
 * Warn if a known content type is missing expected fields.
 * Returns an array of warning strings (empty = no issues).
 *
 * @param {unknown} content
 * @returns {string[]}
 */
export function checkContentType(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const c = /** @type {Record<string, unknown>} */ (content);
  const type = typeof c.type === "string" ? c.type : null;
  if (!type) return [];

  const schema = CONTENT_TYPE_SCHEMAS[type];
  if (!schema) return [];

  const warnings = [];

  for (const field of schema.required ?? []) {
    if (c[field] == null) {
      warnings.push(`content.type is "${type}" but required field "${field}" is missing`);
    }
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    const satisfiesAny = schema.oneOf.some((group) =>
      group.every((field) => c[field] != null),
    );
    if (!satisfiesAny) {
      const options = schema.oneOf.map((g) => g.join(" + ")).join(" | ");
      warnings.push(
        `content.type is "${type}" but needs at least one of: ${options}`,
      );
    }
  }

  return warnings;
}

/**
 * List all known type names.
 * @returns {string[]}
 */
export function knownContentTypes() {
  return Object.keys(CONTENT_TYPE_SCHEMAS);
}
