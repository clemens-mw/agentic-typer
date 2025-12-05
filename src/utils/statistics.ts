import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import type { Project } from "./project-workdir.ts";

export interface Statistics {
  timeSeconds: number;
}

export interface NpmStatistics extends Statistics {
  installationTimeSeconds: number;
}

export interface DefinitelyTypedStatistics extends NpmStatistics {
  lookupTimeSeconds: number;
  packagesInstalled: number;
  packagesNotFound: number;
}

export interface ClaudeStatistics extends Statistics {
  costUsd: number;
  turns: number;
}

export interface FixStatistics extends ClaudeStatistics {
  initialErrorCount: number;
  iterations: number;
  behaviorModificationsDetected: number;
  remainingErrorCount: number;
}

export interface FileStatistics extends FixStatistics {
  files: Record<string, FixStatistics>;
  finalCleanup?: FixStatistics;
}

export interface Phase0Statistics extends ClaudeStatistics {
  steps: {
    languageIdentification?: ClaudeStatistics;
    nodeVersionDetection?: ClaudeStatistics;
  };
}

export interface Phase1Statistics extends Statistics {
  steps: {
    typescriptSetup?: NpmStatistics;
    definitelyTypedInstallation?: DefinitelyTypedStatistics;
    initialErrorFixing?: FileStatistics;
  };
}

export interface Phase2Statistics extends Statistics {
  steps: {
    implicitAnyFixing?: FileStatistics;
  };
}

export interface StatisticsFile {
  phase0?: Phase0Statistics;
  phase1?: Phase1Statistics;
  phase2?: Phase2Statistics;
}

export function loadStatistics(project: Project): StatisticsFile {
  const filePath = getStatisticsFilePath(project);
  if (!existsSync(filePath)) return {};

  const content = readFileSync(filePath, "utf-8");
  const parsed: unknown = JSON.parse(content);
  if (!isStatisticsFile(parsed))
    throw new Error("Invalid statistics file format");

  return parsed;
}

export function saveStatistics(
  project: Project,
  statistics: StatisticsFile,
): void {
  const filePath = getStatisticsFilePath(project);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(statistics, null, 2));
}

function getStatisticsFilePath(project: Project): string {
  const projectName = basename(project.path);
  return join("./workdir", `${projectName}-stats.json`);
}

function isStatisticsFile(value: unknown): value is StatisticsFile {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return true;
  }
  return false;
}
