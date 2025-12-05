import { existsSync, readFileSync } from "fs";
import {
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  resolveModuleName,
  type Node,
  type Program,
  type SourceFile,
} from "typescript";
import { createOrGetWatchProgram } from "./typescript.ts";

export class DependencyGraph {
  private readonly graph = new Map<string, Set<string>>();
  private readonly program: Program;

  public constructor(tsconfigPath: string) {
    this.program = createOrGetWatchProgram(tsconfigPath);
    this.buildGraph();
  }

  public get(filePath: string): string[] {
    const dependencies = this.graph.get(filePath);
    if (!dependencies)
      throw new Error(`No dependencies found for file: ${filePath}`);
    return Array.from(dependencies);
  }

  private buildGraph(): void {
    const sourceFiles = this.getProjectSourceFiles();

    for (const sourceFile of sourceFiles) {
      const dependencies = this.extractFileDependencies(sourceFile);
      this.graph.set(sourceFile.fileName, dependencies);
    }
  }

  private getProjectSourceFiles(): SourceFile[] {
    return this.program
      .getSourceFiles()
      .filter((file) => !file.isDeclarationFile);
  }

  private extractFileDependencies(sourceFile: SourceFile): Set<string> {
    const dependencies = new Set<string>();

    const visit = (node: Node): void => {
      const dependency = this.tryExtractDependency(node, sourceFile);
      if (dependency !== null) dependencies.add(dependency);
      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);
    return dependencies;
  }

  private tryExtractDependency(
    node: Node,
    sourceFile: SourceFile,
  ): string | null {
    const moduleName = extractModuleName(node);
    if (moduleName === null) return null;

    const { resolvedModule } = resolveModuleName(
      moduleName,
      sourceFile.fileName,
      this.program.getCompilerOptions(),
      {
        fileExists: existsSync,
        readFile: (fileName) => readFileSync(fileName, { encoding: "utf-8" }),
      },
    );

    if (!resolvedModule || resolvedModule.isExternalLibraryImport === true)
      return null;

    return resolvedModule.resolvedFileName;
  }
}

function extractModuleName(node: Node): string | null {
  if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text;
  }

  if (
    isExportDeclaration(node) &&
    node.moduleSpecifier &&
    isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }

  if (isCallExpression(node) && isIdentifier(node.expression)) {
    if (node.expression.text === "require" && node.arguments.length > 0) {
      const [firstArg] = node.arguments;
      if (firstArg && isStringLiteral(firstArg)) {
        return firstArg.text;
      }
    }
  }

  return null;
}
