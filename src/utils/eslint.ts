import { ESLint } from "eslint";
import { defineConfig } from "eslint/config";
import { dirname } from "path";
import tseslint from "typescript-eslint";
import { LINTING_RULES } from "./linting-rules.ts";
import type { Project } from "./project-workdir.ts";
import { createOrGetWatchProgram } from "./typescript.ts";

export interface ESLintError {
  filePath: string;
  line: number;
  column: number;
  message: string;
  ruleId: string | null;
  severity: number;
}

export async function getESLintErrors(
  project: Project,
  filePath?: string,
): Promise<ESLintError[]> {
  const eslint = configureESLint(project);
  if (typeof filePath === "string") {
    return getESLintErrorsForFile(eslint, filePath);
  }
  return getAllESLintErrors(eslint, project);
}

function configureESLint(project: Project): ESLint {
  const tseslintConfig = defineConfig(tseslint.configs.base, {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        programs: [createOrGetWatchProgram(project.tsconfigPath)],
      },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: LINTING_RULES,
  });

  return new ESLint({
    allowInlineConfig: false,
    cwd: dirname(project.path),
    overrideConfig: tseslintConfig,
    overrideConfigFile: true,
  });
}

async function getESLintErrorsForFile(
  eslint: ESLint,
  filePath: string,
): Promise<ESLintError[]> {
  const results = await eslint.lintFiles([filePath]);

  const errors: ESLintError[] = [];
  for (const result of results) {
    for (const message of result.messages) {
      errors.push({
        column: message.column,
        filePath: result.filePath,
        line: message.line,
        message: message.message,
        ruleId: message.ruleId,
        severity: message.severity,
      });
    }
  }

  return errors;
}

async function getAllESLintErrors(
  eslint: ESLint,
  project: Project,
): Promise<ESLintError[]> {
  const sourceFiles = getProjectSourceFiles(project);
  const allErrors: ESLintError[] = [];

  for (const [idx, filePath] of sourceFiles.entries()) {
    const errors = await getESLintErrorsForFile(eslint, filePath);
    allErrors.push(...errors);
    reportLintingProgress(idx + 1, sourceFiles.length);
  }

  return allErrors;
}

function getProjectSourceFiles(project: Project): string[] {
  const program = createOrGetWatchProgram(project.tsconfigPath);
  return program
    .getSourceFiles()
    .filter(
      ({ fileName }) =>
        fileName.endsWith(".ts") && !fileName.includes("node_modules"),
    )
    .map((sf) => sf.fileName);
}

function reportLintingProgress(lintedFiles: number, totalFiles: number): void {
  if (lintedFiles % 10 === 0 || lintedFiles === totalFiles) {
    const percentage = Math.floor((lintedFiles / totalFiles) * 100);
    process.stdout.write(
      `\rChecking ESLint errors... ${lintedFiles}/${totalFiles} (${percentage}%)`,
    );
    if (lintedFiles === totalFiles) console.log();
  }
}
