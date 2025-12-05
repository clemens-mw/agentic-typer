import { IdentifyLanguageAgent } from "../agents/analysis/language.ts";
import { IdentifyNodeVersionAgent } from "../agents/analysis/node-version.ts";
import type { Project } from "../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../utils/statistics.ts";

export async function phase0Analysis(project: Project): Promise<void> {
  initializeStatistics(project);

  await IdentifyLanguageAgent.run(project);
  await IdentifyNodeVersionAgent.run(project);
}

function initializeStatistics(project: Project): void {
  const stats = loadStatistics(project);

  stats.phase0 = {
    timeSeconds: 0,
    costUsd: 0,
    turns: 0,
    steps: {},
  };

  saveStatistics(project, stats);
}
