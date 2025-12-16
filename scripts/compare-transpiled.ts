import { exec } from "child_process";
import { createPatch } from "diff";
import { format } from "prettier";
import type { CompilerOptions } from "typescript";
import { promisify } from "util";
import { Project } from "../src/utils/project-workdir.ts";
import { createOneTimeProgram } from "../src/utils/typescript.ts";

const execAsync = promisify(exec);

await main();

async function main(): Promise<void> {
  const { projectPath, commitRef } = parseArgs();
  const project = await Project.load(projectPath);

  const { current, previous } = await transpileStates(project, commitRef);
  await compare(current, previous);
}

function parseArgs(): {
  projectPath: string;
  commitRef: string;
} {
  const [, , projectPath, commitRef] = process.argv;
  if (projectPath === undefined || commitRef === undefined) {
    console.error(
      "Usage: node scripts/compare-transpiled.ts <project-path> <commit-ref>",
    );
    process.exit(1);
  }
  return { projectPath, commitRef };
}

async function transpileStates(
  project: Project,
  commitRef: string,
): Promise<{
  current: Map<string, string>;
  previous: Map<string, string>;
}> {
  const { path } = project;
  await ensureCleanWorkingDirectory(path);

  console.log("Transpiling current state...");
  const originalRef = await execGit("rev-parse --abbrev-ref HEAD", path);
  const current = transpileFiles(project.tsconfigPath);

  console.log("Transpiling previous state...");
  await execGit(`checkout ${commitRef}`, path);
  const previous = transpileFiles(project.tsconfigPath);

  await execGit(`checkout ${originalRef}`, path);
  return { current, previous };
}

function transpileFiles(tsconfigPath: string): Map<string, string> {
  const options: CompilerOptions = {
    sourceMap: false,
    removeComments: true,
    noEmit: false,
    outDir: "/tmp/typescript-transpile",
  };
  const program = createOneTimeProgram(tsconfigPath, options);

  const result = new Map<string, string>();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    program.emit(sourceFile, (_outFile, data) => {
      result.set(sourceFile.fileName, data);
    });
  }
  if (result.size === 0) throw new Error("No files were transpiled.");
  return result;
}

async function ensureCleanWorkingDirectory(cwd: string): Promise<void> {
  const status = await execGit("status --porcelain", cwd);
  if (status !== "") {
    throw new Error(
      "Working directory has uncommitted changes. Please commit or stash your changes before running this script.",
    );
  }
}

async function execGit(command: string, cwd: string): Promise<string> {
  const { stdout } = await execAsync(`git ${command}`, { cwd });
  return stdout.trim();
}

// eslint-disable-next-line max-statements
async function compare(
  current: Map<string, string>,
  previous: Map<string, string>,
): Promise<void> {
  let changed = 0;

  console.log("Comparing...\n");
  for (const [filepath, previousCode] of previous.entries()) {
    const currentCode = current.get(filepath);
    if (currentCode === undefined) {
      console.log(`File missing in current state: ${filepath}\n`);
      changed += 1;
      continue;
    }

    const diff = await computeDiff(filepath, currentCode, previousCode);
    if (diff !== null) {
      changed += 1;
      console.log(diff);
    }
  }

  console.log(`Summary: ${changed} changed file(s)`);
}

async function computeDiff(
  filepath: string,
  currentCode: string,
  previousCode: string,
): Promise<string | null> {
  const formattedCurrent = await format(currentCode, { filepath });
  const formattedPrevious = await format(previousCode, { filepath });

  if (formattedCurrent === formattedPrevious) return null;

  return createPatch(
    filepath,
    formattedPrevious,
    formattedCurrent,
    "previous",
    "current",
  );
}
