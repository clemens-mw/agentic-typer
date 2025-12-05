import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";

export type Language = "javascript" | "typescript";

interface ProjectData {
  path: string;
  phase: number;
  language?: Language;
  nodeVersion?: string;
  buildCommand?: string;
  definitelyTypedInstalled?: boolean;
}

export class Project {
  private readonly data: ProjectData;
  private readonly workdirFilePath: string;

  private constructor(data: ProjectData, workdirFilePath: string) {
    this.data = data;
    this.workdirFilePath = workdirFilePath;
  }

  public get path(): string {
    return this.data.path;
  }

  public get phase(): number {
    return this.data.phase;
  }

  public get language(): Language {
    if (!this.data.language) throw new Error("language is not set.");
    return this.data.language;
  }

  public get nodeVersion(): string {
    if (typeof this.data.nodeVersion !== "string") {
      throw new Error("nodeVersion is not set.");
    }
    return this.data.nodeVersion;
  }

  public get tsconfigPath(): string {
    return join(this.data.path, "tsconfig.json");
  }

  public get buildCommand(): string {
    if (typeof this.data.buildCommand !== "string") {
      throw new Error("buildCommand is not set.");
    }
    return this.data.buildCommand;
  }

  public get definitelyTypedInstalled(): boolean {
    return this.data.definitelyTypedInstalled ?? false;
  }

  public static async load(projectNameOrPath: string): Promise<Project> {
    const workdirFilePath = getWorkdirFilePath(projectNameOrPath);
    const data = existsSync(workdirFilePath)
      ? await loadProjectFile(workdirFilePath)
      : await createProjectFile(workdirFilePath, projectNameOrPath);
    return new Project(data, workdirFilePath);
  }

  public async increasePhase(): Promise<void> {
    this.data.phase += 1;
    await this.persist();
  }

  public async setLanguage(language: Language): Promise<void> {
    this.data.language = language;
    await this.persist();
  }

  public async setNodeVersion(nodeVersion: string): Promise<void> {
    this.data.nodeVersion = nodeVersion;
    await this.persist();
  }

  public async setBuildCommand(buildCommand: string): Promise<void> {
    this.data.buildCommand = buildCommand;
    await this.persist();
  }

  public async setDefinitelyTypedInstalled(installed: boolean): Promise<void> {
    this.data.definitelyTypedInstalled = installed;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await persistData(this.workdirFilePath, this.data);
  }
}

function getWorkdirFilePath(projectNameOrPath: string): string {
  const projectName = basename(projectNameOrPath);
  return join("./workdir", `${projectName}.json`);
}

async function loadProjectFile(workdirFilePath: string): Promise<ProjectData> {
  const content = await readFile(workdirFilePath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const data = JSON.parse(content) as ProjectData;
  console.log(`Loaded project from '${workdirFilePath}'`);
  return data;
}

async function createProjectFile(
  workdirFilePath: string,
  projectNameOrPath: string,
): Promise<ProjectData> {
  const projectPath = resolve(projectNameOrPath);
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  const data: ProjectData = { path: projectPath, phase: 0 };
  await mkdir("./workdir", { recursive: true });
  await persistData(workdirFilePath, data);
  console.log(`Created new project file at '${workdirFilePath}'`);
  return data;
}

export async function persistData(
  filePath: string,
  data: ProjectData,
): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);
  await writeFile(filePath, jsonString, "utf-8");
}
