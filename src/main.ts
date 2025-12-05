import { basename } from "path";
import { phase0Analysis } from "./phases/phase0-analysis.ts";
import { phase1MinimalSetup } from "./phases/phase1-minimal-setup.ts";
import { phase2CompleteCoverage } from "./phases/phase2-complete-coverage.ts";
import { Project } from "./utils/project-workdir.ts";
import { closeWatchProgram } from "./utils/typescript.ts";

try {
  await main();
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
} finally {
  closeWatchProgram();
}

async function main(): Promise<void> {
  const projectNameOrPath = getProjectFromArgs();
  const project = await Project.load(projectNameOrPath);
  await executePhase(project);
}

function getProjectFromArgs(): string {
  const args = process.argv.slice(2);
  const [userInput] = args;
  if (typeof userInput === "undefined") {
    console.error("Error: Project name or path is required");
    console.error("Usage: npm start <project-name-or-path>");
    process.exit(1);
  }
  return userInput.trim();
}

async function executePhase(project: Project): Promise<void> {
  const { phase } = project;
  const phases = [phase0Analysis, phase1MinimalSetup, phase2CompleteCoverage];
  const phaseExecution = phases[phase];
  if (typeof phaseExecution === "undefined") {
    throw new Error(`Phase ${phase} does not exist.`);
  }
  console.log(`Executing phase ${phase} for project at '${project.path}'...`);
  await phaseExecution(project);
  await project.increasePhase();
  console.log(
    `Phase ${phase} complete. Run 'npm start ${basename(project.path)}' to continue.`,
  );
}
