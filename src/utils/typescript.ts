import { readFile } from "fs/promises";
import { dirname } from "path";
import {
  createProgram,
  createWatchCompilerHost,
  createWatchProgram,
  DiagnosticCategory,
  getPreEmitDiagnostics,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
  transpileModule,
  type BuilderProgram,
  type CompilerOptions,
  type Diagnostic,
  type ParsedCommandLine,
  type Program,
  type WatchOfConfigFile,
} from "typescript";
import type { Project } from "./project-workdir.ts";

let watchProgram: WatchOfConfigFile<BuilderProgram> | null = null;
let currentTsconfigPath: string | null = null;

export function createOrGetWatchProgram(tsconfigPath: string): Program {
  if (watchProgram && currentTsconfigPath === tsconfigPath) {
    return watchProgram.getProgram().getProgram();
  }

  const host = createWatchCompilerHost(tsconfigPath, {}, sys);
  host.onWatchStatusChange = (): void => {
    // Suppress watch status output
  };
  host.afterProgramCreate = (): void => {
    // Suppress diagnostic output
  };
  watchProgram = createWatchProgram(host);
  currentTsconfigPath = tsconfigPath;
  return watchProgram.getProgram().getProgram();
}

export function closeWatchProgram(): void {
  if (watchProgram) {
    watchProgram.close();
    watchProgram = null;
    currentTsconfigPath = null;
  }
}

export function getTsErrors(
  project: Project,
  params: { file?: string | undefined; options?: CompilerOptions } = {},
): Diagnostic[] {
  const { tsconfigPath } = project;
  const program =
    typeof params.options === "undefined"
      ? createOrGetWatchProgram(tsconfigPath)
      : createOneTimeProgram(tsconfigPath, params.options);
  const diagnostics = getDiagnostics(program, params.file);
  return filterErrors(diagnostics);
}

export async function transpile(
  fileName: string,
  project: Project,
): Promise<string> {
  const sourceCode = await readFile(fileName, "utf-8");
  const tsConfig = parseConfigFile(project.tsconfigPath);
  const compilerOptions = { ...tsConfig.options, removeComments: true };
  const result = transpileModule(sourceCode, { compilerOptions, fileName });
  return result.outputText;
}

export function createOneTimeProgram(
  tsconfigPath: string,
  optionsOverride?: CompilerOptions,
): Program {
  const tsConfig = parseConfigFile(tsconfigPath);
  const options = { ...tsConfig.options, ...optionsOverride };
  return createProgram({ rootNames: tsConfig.fileNames, options });
}

function getDiagnostics(
  program: Program,
  file?: string,
): readonly Diagnostic[] {
  if (typeof file !== "string") return getPreEmitDiagnostics(program);

  const sourceFile = program.getSourceFile(file);
  if (!sourceFile) throw new Error(`File '${file}' not found in the program.`);
  return getPreEmitDiagnostics(program, sourceFile);
}

function filterErrors(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(
    ({ category, reportsUnnecessary }) =>
      category === DiagnosticCategory.Error && !reportsUnnecessary,
  );
}

function parseConfigFile(tsconfigPath: string): ParsedCommandLine {
  const configFile = readConfigFile(tsconfigPath, sys.readFile);
  if (configFile.error) {
    throw new Error(`Error reading tsconfig at '${tsconfigPath}.'`);
  }
  const basePath = dirname(tsconfigPath);
  return parseJsonConfigFileContent(configFile.config, sys, basePath);
}
