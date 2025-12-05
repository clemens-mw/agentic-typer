import { FixProjectErrorsAgent } from "../agents/errors/fix-project-errors.ts";
import { InstallDefinitelyTypedAgent } from "../agents/setup/install-definitely-typed.ts";
import { SetupTypeScriptAgent } from "../agents/setup/setup-typescript.ts";
import type { Project } from "../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../utils/statistics.ts";

export async function phase1MinimalSetup(project: Project): Promise<void> {
  initializeStatistics(project);

  await SetupTypeScriptAgent.run(project);
  await InstallDefinitelyTypedAgent.run(project);
  await FixProjectErrorsAgent.run(project);
}

function initializeStatistics(project: Project): void {
  const stats = loadStatistics(project);
  stats.phase1 = { timeSeconds: 0, steps: {} };
  saveStatistics(project, stats);
}
