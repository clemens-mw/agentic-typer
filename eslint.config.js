import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.all,
  tseslint.configs.all,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  prettierConfig,
  {
    rules: {
      /* eslint-disable @typescript-eslint/naming-convention */
      "@typescript-eslint/init-declarations": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-use-before-define": [
        "error",
        { functions: false },
      ],
      "@typescript-eslint/prefer-readonly-parameter-types": "off",
      "@typescript-eslint/unbound-method": "off",
      "capitalized-comments": "off",
      "func-style": ["error", "declaration"],
      "no-await-in-loop": "off",
      "no-console": "off",
      "no-ternary": "off",
      "one-var": ["error", "never"],
      "require-atomic-updates": "off",
      "sort-imports": "off",
      "sort-keys": ["error", "asc", { minKeys: 5 }],
    },
  },
);
