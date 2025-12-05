import { readFileSync } from "fs";
import type { ProjectError } from "./project-errors.ts";
import type { Project } from "./project-workdir.ts";

const MAX_ERRORS_PER_BATCH = 100;

interface ErrorsWithContext {
  errors: ProjectError[];
  codeContext: string;
}

export function formatErrorsWithContext(
  errors: ProjectError[],
  project: Project,
): string {
  const errorCount = errors.length;
  const contextSize = determineContextSize(errorCount);
  const errorsByLocation = groupErrorsByLocation(errors, contextSize);
  let formattedErrors = formatErrorGroups(errorsByLocation, project);
  if (errorCount > MAX_ERRORS_PER_BATCH) {
    formattedErrors = `There are ${errorCount} errors in total, here are the first ${MAX_ERRORS_PER_BATCH}:\n\n${formattedErrors}`;
  }
  return formattedErrors;
}

function determineContextSize(errorCount: number): number {
  if (errorCount >= 50) return 1;
  if (errorCount >= 10) return 2;
  return 3;
}

function groupErrorsByLocation(
  errors: ProjectError[],
  contextSize: number,
): Map<string, ErrorsWithContext> {
  const errorsByLocation = new Map<string, ErrorsWithContext>();
  for (const error of errors.slice(0, MAX_ERRORS_PER_BATCH)) {
    const line = error.line - 1;
    const key = `${error.filePath}:${line}`;
    const existing = errorsByLocation.get(key);
    if (existing) existing.errors.push(error);
    else {
      const codeContext = formatCodeContext(error.filePath, line, contextSize);
      errorsByLocation.set(key, { errors: [error], codeContext });
    }
  }
  return errorsByLocation;
}

function formatCodeContext(
  filePath: string,
  errorLine: number,
  contextSize: number,
): string {
  const lines = readFileSync(filePath, "utf-8").split("\n");
  const startLine = errorLine - contextSize;
  const endLine = errorLine + contextSize;

  const formattedLines: string[] = [];
  for (let index = startLine; index <= endLine; index += 1) {
    const content = lines[index];
    if (typeof content === "string") {
      const lineNumber = index + 1;
      formattedLines.push(formatLine(lineNumber, content, index === errorLine));
    }
  }
  return formattedLines.join("\n");
}

function formatLine(
  lineNumber: number,
  content: string,
  isErrorLine: boolean,
): string {
  const marker = isErrorLine ? ">" : " ";
  const lineNumStr = lineNumber.toString().padStart(4, " ");
  return `${marker} ${lineNumStr} | ${content}`;
}

function formatErrorGroups(
  errorsByLocation: Map<string, ErrorsWithContext>,
  project: Project,
): string {
  const groups: string[] = [];
  for (const [, { errors, codeContext }] of errorsByLocation) {
    const formatted = formatErrors(errors, project);
    groups.push(`${formatted}\n${codeContext}`);
  }
  return groups.join("\n\n");
}

function formatErrors(errors: ProjectError[], project: Project): string {
  const lines: string[] = [];
  for (const error of errors) {
    const relativePath = error.filePath.replace(`${project.path}/`, "");
    const codePrefix = error.source === "typescript" ? "TS" : "";
    const codeInfo = error.code === null ? "" : ` (${codePrefix}${error.code})`;
    lines.push(
      `${relativePath}:${error.line}:${error.column} - ${error.message}${codeInfo}`,
    );
  }
  return lines.join("\n");
}
