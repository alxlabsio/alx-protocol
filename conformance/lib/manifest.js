import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import { REPO_ROOT } from "./repo-root.js";
import { sha256Text } from "./text-digest.js";

export const CORE_MANIFEST_PATH = "protocol/suites.json";
export const SUPPORTED_VECTOR_FORMAT = "1";

function resolveInsideRepository(repositoryRoot, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("Manifest path must be a non-empty string");
  }
  const absolutePath = resolve(repositoryRoot, relativePath);
  const fromRoot = relative(repositoryRoot, absolutePath);
  if (fromRoot === "" || fromRoot.startsWith("..") || fromRoot.split(sep).includes("..")) {
    throw new Error(`Manifest path escapes repository: ${relativePath}`);
  }
  return absolutePath;
}

function readJson(repositoryRoot, relativePath) {
  const absolutePath = resolveInsideRepository(repositoryRoot, relativePath);
  let source;
  try {
    source = readFileSync(absolutePath);
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
  try {
    return { absolutePath, source, document: JSON.parse(source.toString("utf8")) };
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON (${error.message})`);
  }
}

function formatSchemaErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

function compileValidators(repositoryRoot) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  const manifestSchema = readJson(repositoryRoot, "protocol/schemas/suite-manifest.schema.json").document;
  const definitionsSchema = readJson(repositoryRoot, "protocol/schemas/defs.schema.json").document;
  const verificationContextSchema = readJson(repositoryRoot, "protocol/schemas/verification-context.schema.json").document;
  const graphValidationRequestSchema = readJson(repositoryRoot, "protocol/schemas/graph-validation-request.schema.json").document;
  const graphVerificationSchema = readJson(repositoryRoot, "protocol/schemas/graph-verification.schema.json").document;
  const vectorSchema = readJson(repositoryRoot, "protocol/schemas/test-vector.schema.json").document;
  const expectedResultsSchema = readJson(repositoryRoot, "protocol/schemas/expected-results.schema.json").document;
  ajv.addSchema(definitionsSchema, definitionsSchema.$id);
  ajv.addSchema(verificationContextSchema, verificationContextSchema.$id);
  ajv.addSchema(graphValidationRequestSchema, graphValidationRequestSchema.$id);
  ajv.addSchema(graphVerificationSchema, graphVerificationSchema.$id);
  ajv.addSchema(vectorSchema, vectorSchema.$id);
  ajv.addSchema(expectedResultsSchema, expectedResultsSchema.$id);
  ajv.addSchema(manifestSchema, manifestSchema.$id);
  return {
    validateManifest: ajv.getSchema(manifestSchema.$id),
    validateVectors: ajv.getSchema(vectorSchema.$id),
    validateExpected(operation, expected) {
      const validator = ajv.getSchema(`${expectedResultsSchema.$id}#/$defs/${operation}`);
      if (!validator) throw new Error(`unsupported vector operation ${operation}`);
      return { valid: validator(expected), errors: validator.errors };
    },
  };
}

export function loadCoreManifest(options = {}) {
  const repositoryRoot = options.repositoryRoot ?? REPO_ROOT;
  const manifestPath = options.manifestPath ?? CORE_MANIFEST_PATH;
  const { document: manifest } = readJson(repositoryRoot, manifestPath);
  const { validateManifest, validateVectors, validateExpected } = compileValidators(repositoryRoot);

  if (!validateManifest(manifest)) {
    throw new Error(`${manifestPath}: ${formatSchemaErrors(validateManifest.errors)}`);
  }
  if (manifest.vectorFormat !== SUPPORTED_VECTOR_FORMAT) {
    throw new Error(`${manifestPath}: unsupported vectorFormat ${manifest.vectorFormat}`);
  }

  const suiteIds = new Set();
  const vectorIds = new Set();
  const suites = [];
  for (const descriptor of manifest.core.suites) {
    if (suiteIds.has(descriptor.id)) throw new Error(`${manifestPath}: duplicate suite ID ${descriptor.id}`);
    suiteIds.add(descriptor.id);

    const { absolutePath, source, document } = readJson(repositoryRoot, descriptor.path);
    if (!validateVectors(document)) {
      throw new Error(`${descriptor.path}: ${formatSchemaErrors(validateVectors.errors)}`);
    }
    if (document.$schema !== descriptor.schema) {
      throw new Error(`${descriptor.path}: $schema does not match manifest schema`);
    }
    if (document.suite !== descriptor.id) {
      throw new Error(`${descriptor.path}: suite ${JSON.stringify(document.suite)} does not match ${descriptor.id}`);
    }
    if (document.vectors.length !== descriptor.vectorCount) {
      throw new Error(`${descriptor.path}: vectorCount ${document.vectors.length} does not match ${descriptor.vectorCount}`);
    }
    const actualDigest = sha256Text(source);
    if (actualDigest !== descriptor.sha256) {
      throw new Error(`${descriptor.path}: sha256 ${actualDigest} does not match ${descriptor.sha256}`);
    }
    for (const vector of document.vectors) {
      if (vectorIds.has(vector.id)) throw new Error(`${descriptor.path}: duplicate core vector ID ${vector.id}`);
      vectorIds.add(vector.id);
      if (descriptor.operation === "per-vector" && typeof vector.operation !== "string") {
        throw new Error(`${descriptor.path}#${vector.id}: operation is required`);
      }
      const operation = descriptor.operation === "per-vector" ? vector.operation : descriptor.operation;
      const expectedValues = "expected" in vector
        ? [vector.expected]
        : [vector.expected_a, vector.expected_b];
      for (const expected of expectedValues) {
        const result = validateExpected(operation, expected);
        if (!result.valid) {
          throw new Error(`${descriptor.path}#${vector.id}: expected result for ${operation} is invalid (${formatSchemaErrors(result.errors)})`);
        }
      }
    }
    suites.push({ descriptor, document, absolutePath });
  }

  for (const extension of manifest.extensions) {
    if (!existsSync(resolveInsideRepository(repositoryRoot, extension.manifest))) {
      throw new Error(`${manifestPath}: missing extension manifest ${extension.manifest}`);
    }
  }

  return { manifest, suites, suiteIds, vectorIds };
}
