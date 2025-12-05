/* eslint-disable @typescript-eslint/naming-convention */

import type { Linter } from "eslint";

export const LINTING_RULES = {
  "@typescript-eslint/no-explicit-any": "error",
} satisfies Linter.RulesRecord;
