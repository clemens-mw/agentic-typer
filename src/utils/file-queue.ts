import { DependencyGraph } from "./file-dependencies.ts";
import type { Project } from "./project-workdir.ts";

export class FileQueue {
  private readonly dependencies: DependencyGraph;
  private readonly unprocessedFiles: Set<string>;
  private readonly processingFiles = new Set<string>();

  public constructor(project: Project, files: string[]) {
    this.dependencies = new DependencyGraph(project.tsconfigPath);
    this.unprocessedFiles = new Set(files);
  }

  public shift(): string {
    const file = this.selectFileWithLeastDependencies();
    if (file === null) {
      throw new Error("No more files to process");
    }
    this.unprocessedFiles.delete(file);
    this.processingFiles.add(file);
    return file;
  }

  public markAsProcessed(filePath: string): void {
    this.processingFiles.delete(filePath);
  }

  public hasUnprocessedFiles(): boolean {
    return this.unprocessedFiles.size > 0;
  }

  private selectFileWithLeastDependencies(): string | null {
    let bestFile: string | null = null;
    let minDeps = Number.POSITIVE_INFINITY;

    for (const filePath of this.unprocessedFiles) {
      const deps = this.countUnprocessedDependencies(filePath);
      if (deps < minDeps) {
        minDeps = deps;
        bestFile = filePath;
      }
    }

    return bestFile;
  }

  private countUnprocessedDependencies(filePath: string): number {
    const fileDeps = this.dependencies.get(filePath);
    return fileDeps.filter((dep) =>
      this.unprocessedFiles.union(this.processingFiles).has(dep),
    ).length;
  }
}
