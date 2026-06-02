/**
 * Verification-context model.
 *
 * This model is intentionally outside the v1 Block primitive. It provides a
 * machine-readable place for future Graph validation semantics without changing
 * current Block identity or current closed-world verifier behavior.
 */

export type ValidationMode = "closed-world" | "open-world";

export interface ExternalParentBoundary {
  hash: string;
  reason: "external-boundary" | "private-boundary" | "unavailable-boundary" | "unknown-boundary";
  declaredBy: "verification-context";
  requiredForFullValidation: boolean;
}

export interface VerificationContext {
  protocolVersion: "1";
  validationMode: ValidationMode;
  graphRoot: string;
  extensions: string[];
  externalParents: ExternalParentBoundary[];
}
