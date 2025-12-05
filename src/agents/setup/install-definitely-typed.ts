import { readFile } from "fs/promises";
import { join } from "path";
import type { Diagnostic } from "typescript";
import {
  npmInstallDevDependencies,
  npmViewPackageVersion,
} from "../../utils/npm.ts";
import type { Project } from "../../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../../utils/statistics.ts";
import { getTsErrors } from "../../utils/typescript.ts";

export class InstallDefinitelyTypedAgent {
  private readonly project: Project;
  private readonly stats = {
    installationTimeSeconds: 0,
    lookupTimeSeconds: 0,
    packagesInstalled: 0,
    packagesNotFound: 0,
    timeSeconds: 0,
  };

  private constructor(project: Project) {
    this.project = project;
  }

  public static async run(project: Project): Promise<void> {
    const agent = new InstallDefinitelyTypedAgent(project);
    await agent.execute();
    agent.saveStatistics();
  }

  private async execute(): Promise<void> {
    if (this.project.definitelyTypedInstalled)
      console.log(
        "Type definitions already installed, skipping DefinitelyTyped installation.",
      );
    else {
      const startTime = performance.now();
      await this.installNodeTypes();
      await this.installMissingTypeDefinitions();
      await this.project.setDefinitelyTypedInstalled(true);
      const endTime = performance.now();
      this.stats.timeSeconds += (endTime - startTime) / 1000;
    }
  }

  private async installNodeTypes(): Promise<void> {
    const majorVersion = this.getNodeMajorVersion();
    const packageSpec = `@types/node@${majorVersion}`;

    const installStart = performance.now();
    await npmInstallDevDependencies([packageSpec], this.project.path);
    const installEnd = performance.now();
    this.stats.installationTimeSeconds += (installEnd - installStart) / 1000;
    this.stats.packagesInstalled += 1;
  }

  private getNodeMajorVersion(): string {
    const { nodeVersion } = this.project;
    const [majorVersion] = nodeVersion.split(".");
    if (typeof majorVersion !== "string" || majorVersion === "") {
      throw new Error(`Invalid Node.js version: ${nodeVersion}`);
    }
    return majorVersion;
  }

  // eslint-disable-next-line max-statements
  private async installMissingTypeDefinitions(): Promise<void> {
    const missingModules = this.detectMissingTypeDefinitions();
    if (missingModules.length === 0) {
      console.log("No missing type definitions found.");
      return;
    }

    console.log(
      `Found ${missingModules.length} module(s) without type definitions.`,
    );

    const lookupStart = performance.now();
    const validPackages = await this.getValidTypesPackages(missingModules);
    const lookupEnd = performance.now();
    this.stats.lookupTimeSeconds += (lookupEnd - lookupStart) / 1000;

    if (validPackages.length === 0) {
      console.log("No @types packages available for missing modules.");
      this.stats.packagesNotFound = missingModules.length;
      return;
    }

    const installStart = performance.now();
    await npmInstallDevDependencies(validPackages, this.project.path);
    const installEnd = performance.now();
    this.stats.installationTimeSeconds += (installEnd - installStart) / 1000;

    this.stats.packagesInstalled += validPackages.length;
    this.stats.packagesNotFound = missingModules.length - validPackages.length;
  }

  private detectMissingTypeDefinitions(): string[] {
    const errors = getTsErrors(this.project, {
      options: { noImplicitAny: true },
    });
    const error7016 = errors.filter(({ code }) => code === 7016);
    return extractModuleNames(error7016);
  }

  private async getValidTypesPackages(modules: string[]): Promise<string[]> {
    const packageLockPath = join(this.project.path, "package-lock.json");
    const content = await readFile(packageLockPath, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const packageLock = JSON.parse(content) as {
      packages: Record<string, { version: string }>;
    };

    const validPackages: string[] = [];
    for (const module of modules) {
      const versionSpec =
        packageLock.packages[`node_modules/${module}`]?.version;
      const validPackage = await this.findValidPackage(module, versionSpec);
      if (validPackage !== null) validPackages.push(validPackage);
    }
    return validPackages;
  }

  private async findValidPackage(
    module: string,
    versionSpec: string | undefined,
  ): Promise<string | null> {
    const typesPackage = `@types/${module}`;
    const pattern = /(?<major>\d+)\.\d+\.\d+/u;
    const match = pattern.exec(versionSpec ?? "");
    if (!match?.groups)
      throw new Error(`Cannot determine version for module '${module}'.`);

    const majorSpec = `${typesPackage}@${match.groups["major"]}`;
    if (await this.checkPackageExists(majorSpec)) return majorSpec;

    const latestSpec = `${typesPackage}@latest`;
    if (await this.checkPackageExists(latestSpec)) return latestSpec;

    console.error(`No valid @types package found for module '${module}'.`);
    return null;
  }

  private async checkPackageExists(packageSpec: string): Promise<boolean> {
    try {
      await npmViewPackageVersion(packageSpec, this.project.path);
      return true;
    } catch {
      return false;
    }
  }

  private saveStatistics(): void {
    const stats = loadStatistics(this.project);
    if (!stats.phase1) throw new Error("Phase 1 statistics not initialized.");

    stats.phase1.timeSeconds += this.stats.timeSeconds;
    stats.phase1.steps.definitelyTypedInstallation = this.stats;

    saveStatistics(this.project, stats);
  }
}

function extractModuleNames(diagnostics: Diagnostic[]): string[] {
  const modules = new Set<string>();
  const pattern = /module '(?<moduleName>[^']+)'/u;

  for (const diagnostic of diagnostics) {
    if (typeof diagnostic.messageText !== "object")
      throw new Error("Unexpected diagnostic format.");

    const match = pattern.exec(diagnostic.messageText.messageText);
    const moduleName = match?.groups?.["moduleName"];
    if (typeof moduleName !== "string")
      throw new Error("Unexpected diagnostic format.");

    modules.add(moduleName);
  }

  return Array.from(modules);
}
