import { flattenDiagnosticMessageText, type Diagnostic } from "typescript";
import { getESLintErrors, type ESLintError } from "./eslint.ts";
import type { Project } from "./project-workdir.ts";
import { getTsErrors } from "./typescript.ts";

export type ErrorSource = "typescript" | "eslint";

export interface ProjectError {
  source: ErrorSource;
  filePath: string;
  line: number;
  column: number;
  message: string;
  code: string | number | null;
}

export type ProjectErrorsPerFile = Record<string, ProjectError[]>;

export async function getErrors(
  project: Project,
  file?: string,
): Promise<ProjectError[]> {
  const tsErrors = getTsErrors(project, { file });
  const projectErrors = tsErrors.map(convertTsDiagnostic);

  if (project.phase === 1 || project.language === "javascript") {
    return projectErrors;
  }

  const eslintErrors = await getESLintErrors(project, file);
  const eslintProjectErrors = eslintErrors.map(convertESLintError);
  return [...projectErrors, ...eslintProjectErrors];
}

function convertTsDiagnostic(diagnostic: Diagnostic): ProjectError {
  if (!diagnostic.file || typeof diagnostic.start !== "number") {
    throw new Error("Diagnostic must have file and start properties");
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start,
  );

  return {
    code: diagnostic.code,
    column: character + 1,
    filePath: diagnostic.file.fileName,
    line: line + 1,
    message: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    source: "typescript",
  };
}

function convertESLintError(error: ESLintError): ProjectError {
  return {
    code: error.ruleId,
    column: error.column,
    filePath: error.filePath,
    line: error.line,
    message: error.message,
    source: "eslint",
  };
}

export async function getErrorsPerFile(
  project: Project,
): Promise<ProjectErrorsPerFile> {
  const errors = await getErrors(project);
  return groupErrorsByFile(errors);
}

function groupErrorsByFile(errors: ProjectError[]): ProjectErrorsPerFile {
  const result: ProjectErrorsPerFile = {};
  for (const error of errors) {
    const existing = result[error.filePath];
    if (existing) existing.push(error);
    else result[error.filePath] = [error];
  }
  return result;
}

export function formatErrorsPerFile(
  errorsPerFile: ProjectErrorsPerFile,
): string {
  const { totalTsErrors, totalEslintErrors } = countErrors(errorsPerFile);
  const fileCount = Object.keys(errorsPerFile).length;
  const header = buildHeader(totalTsErrors, totalEslintErrors, fileCount);
  const fileList = buildFileList(errorsPerFile);
  return `${header}${fileList}`;
}

function countErrors(errorsPerFile: ProjectErrorsPerFile): {
  totalTsErrors: number;
  totalEslintErrors: number;
} {
  let totalTsErrors = 0;
  let totalEslintErrors = 0;

  for (const errors of Object.values(errorsPerFile)) {
    for (const error of errors) {
      if (error.source === "typescript") totalTsErrors += 1;
      else totalEslintErrors += 1;
    }
  }

  return { totalTsErrors, totalEslintErrors };
}

function buildHeader(
  totalTsErrors: number,
  totalEslintErrors: number,
  fileCount: number,
): string {
  const totalErrors = totalTsErrors + totalEslintErrors;
  let result = `Found ${totalErrors} errors in ${fileCount} files`;
  if (totalEslintErrors > 0) {
    result += ` (${totalTsErrors} TS, ${totalEslintErrors} ESLint)`;
  }
  return `${result}.\n\nErrors  Files\n`;
}

function buildFileList(errorsPerFile: ProjectErrorsPerFile): string {
  let result = "";
  for (const [fileName, errors] of Object.entries(errorsPerFile)) {
    const errorCountStr = errors.length.toString().padStart(6, " ");
    result += `${errorCountStr}  ${fileName}\n`;
  }
  return result;
}
