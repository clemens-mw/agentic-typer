import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { npmInstallDevDependencies } from "../../utils/npm.ts";
import type { Project } from "../../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../../utils/statistics.ts";

export class SetupTypeScriptAgent {
  private readonly project: Project;
  private readonly stats = { timeSeconds: 0, installationTimeSeconds: 0 };

  private constructor(project: Project) {
    this.project = project;
  }

  public static async run(project: Project): Promise<void> {
    const agent = new SetupTypeScriptAgent(project);
    await agent.execute();
    agent.saveStatistics();
  }

  private async execute(): Promise<void> {
    if (existsSync(this.project.tsconfigPath))
      console.log(
        "Project already has a tsconfig.json, skipping TypeScript setup.",
      );
    else {
      const startTime = performance.now();
      console.log("Setting up TypeScript...");
      const tsconfigBase = this.getTsconfigBase();
      await this.installDependencies(tsconfigBase);
      await this.addBuildCommand();
      await this.createTsconfig(tsconfigBase);
      console.log("TypeScript setup completed.");
      const endTime = performance.now();
      this.stats.timeSeconds += (endTime - startTime) / 1000;
    }
  }

  private async installDependencies(tsconfigBase: string): Promise<void> {
    const installStart = performance.now();
    await npmInstallDevDependencies(
      ["typescript", tsconfigBase],
      this.project.path,
    );
    const installEnd = performance.now();
    this.stats.installationTimeSeconds += (installEnd - installStart) / 1000;
  }

  private getTsconfigBase(): string {
    const { nodeVersion } = this.project;
    const [majorVersion] = nodeVersion.split(".");
    return `@tsconfig/node${majorVersion}`;
  }

  private async addBuildCommand(): Promise<void> {
    const packageJsonPath = join(this.project.path, "package.json");
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const packageJson = JSON.parse(packageJsonContent) as {
      scripts?: Record<string, string>;
    };

    packageJson.scripts ??= {};
    packageJson.scripts["tsc"] = "tsc";
    await writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );

    const buildCommand = "npm run tsc";
    await this.project.setBuildCommand(buildCommand);
    console.log(
      `Added tsc script to package.json. Run '${buildCommand}' to type check.`,
    );
  }

  private async createTsconfig(tsconfigBase: string): Promise<void> {
    const tsconfig = {
      extends: `${tsconfigBase}/tsconfig.json`,
      compilerOptions: { checkJs: true, noEmit: true, strict: false },
    };
    const tsconfigPath = join(this.project.path, "tsconfig.json");
    await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
    console.log(`Created tsconfig.json at '${tsconfigPath}'`);
  }

  private saveStatistics(): void {
    const stats = loadStatistics(this.project);
    if (!stats.phase1) throw new Error("Phase 1 statistics not initialized.");

    stats.phase1.timeSeconds += this.stats.timeSeconds;
    stats.phase1.steps.typescriptSetup = this.stats;

    saveStatistics(this.project, stats);
  }
}
