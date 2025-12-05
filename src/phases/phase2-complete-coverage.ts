import { readFile, writeFile } from "fs/promises";
import type { CompilerOptions } from "typescript";
import { FixProjectErrorsAgent } from "../agents/errors/fix-project-errors.ts";
import type { Project } from "../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../utils/statistics.ts";

export async function phase2CompleteCoverage(project: Project): Promise<void> {
  initializeStatistics(project);

  await enableStrictAnyChecks(project.tsconfigPath);
  await FixProjectErrorsAgent.run(project);
}

function initializeStatistics(project: Project): void {
  const stats = loadStatistics(project);
  stats.phase2 = { timeSeconds: 0, steps: {} };
  saveStatistics(project, stats);
}

async function enableStrictAnyChecks(path: string): Promise<void> {
  const tsconfigContent = await readFile(path, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const tsconfig = JSON.parse(tsconfigContent) as {
    compilerOptions: CompilerOptions;
  };

  tsconfig.compilerOptions.noImplicitAny = true;
  tsconfig.compilerOptions.noImplicitThis = true;
  tsconfig.compilerOptions.useUnknownInCatchVariables = true;

  await writeFile(path, `${JSON.stringify(tsconfig, null, 2)}\n`);
  console.log(`Updated tsconfig.json to check for 'any'`);
}
