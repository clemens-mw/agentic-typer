import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { claudeCode } from "../../utils/claude-code.ts";
import type { Project } from "../../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../../utils/statistics.ts";

export class IdentifyNodeVersionAgent {
  private readonly project: Project;
  private readonly stats = { timeSeconds: 0, costUsd: 0, turns: 0 };

  private constructor(project: Project) {
    this.project = project;
  }

  public static async run(project: Project): Promise<void> {
    const agent = new IdentifyNodeVersionAgent(project);
    await agent.execute();
    agent.saveStatistics();
  }

  private async execute(): Promise<void> {
    const startTime = performance.now();
    console.log("Identifying Node.js version...");
    const versionResponse = await this.detectNodeVersion();
    const version = validateAndNormalize(versionResponse);
    await this.project.setNodeVersion(version);
    console.log(`Identified Node.js version: ${version}`);
    const endTime = performance.now();
    this.stats.timeSeconds += (endTime - startTime) / 1000;
  }

  private async detectNodeVersion(): Promise<string> {
    const nvmrcPath = join(this.project.path, ".nvmrc");
    if (existsSync(nvmrcPath)) return readFile(nvmrcPath, "utf-8");

    const { result, costUsd, turns } = await claudeCode(
      `What Node.js version is specified for this project? Check .node-version, package.json engines field, Dockerfile, docker-compose.yml, or any other configuration files. Only answer with the version number (e.g., "24.2.5" or "15.22.7").`,
      { cwd: this.project.path },
      true,
    );

    this.stats.costUsd += costUsd;
    this.stats.turns += turns;

    return result;
  }

  private saveStatistics(): void {
    const stats = loadStatistics(this.project);
    if (!stats.phase0) throw new Error("Phase 0 statistics not initialized.");

    stats.phase0.timeSeconds += this.stats.timeSeconds;
    stats.phase0.costUsd += this.stats.costUsd;
    stats.phase0.turns += this.stats.turns;
    stats.phase0.steps.nodeVersionDetection = this.stats;

    saveStatistics(this.project, stats);
  }
}

function validateAndNormalize(versionResponse: string): string {
  const version = versionResponse.trim().split("\n").pop();
  if (typeof version === "undefined") {
    throw new Error(
      `Could not detect Node.js version from: ${versionResponse}`,
    );
  }
  const normalized = version.replace("v", "");
  if (!/^\d+\.\d+\.\d+$/u.test(normalized)) {
    throw new Error(`Invalid Node.js version format: ${version}`);
  }
  return normalized;
}
