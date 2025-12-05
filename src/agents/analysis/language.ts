import { claudeCode } from "../../utils/claude-code.ts";
import type { Language, Project } from "../../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../../utils/statistics.ts";

export class IdentifyLanguageAgent {
  private readonly project: Project;
  private readonly stats = { timeSeconds: 0, costUsd: 0, turns: 0 };

  private constructor(project: Project) {
    this.project = project;
  }

  public static async run(project: Project): Promise<void> {
    const agent = new IdentifyLanguageAgent(project);
    await agent.execute();
    agent.saveStatistics();
  }

  private async execute(): Promise<void> {
    const startTime = performance.now();
    console.log("Identifying project programming language...");
    const languageResponse = await this.detectLanguage();
    const language = validateAndNormalize(languageResponse);
    await this.project.setLanguage(language);
    console.log(`Identified language: ${language}`);
    const endTime = performance.now();
    this.stats.timeSeconds += (endTime - startTime) / 1000;
  }

  private async detectLanguage(): Promise<string> {
    const { result, costUsd, turns } = await claudeCode(
      `What is the primary programming language in this repository? Only answer with the language name.`,
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
    stats.phase0.steps.languageIdentification = this.stats;

    saveStatistics(this.project, stats);
  }
}

function validateAndNormalize(languageResponse: string): Language {
  const language = languageResponse.trim().split("\n").pop()?.toLowerCase();
  if (language === "javascript" || language === "typescript") return language;
  throw new Error(`Unsupported language: ${languageResponse}`);
}
