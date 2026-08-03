import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const ignoredPaths = [
  "**/node_modules/**",
  "**/dist/**",
  "**/target/**",
  "**/coverage/**",
  "contracts/artifacts/**",
  "contracts/cache/**",
  "_site/**",
];

const typescriptConfigs = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: ["**/*.ts"],
  languageOptions: {
    ...config.languageOptions,
    ecmaVersion: "latest",
    sourceType: "module",
    globals: { ...globals.node, ...globals.browser },
  },
}));

export default [
  { ignores: ignoredPaths },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.cjs", "contracts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.mocha },
    },
  },
  ...typescriptConfigs,
  {
    files: ["**/*.ts"],
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
