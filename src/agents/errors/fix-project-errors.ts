import { green } from "../../utils/console-colors.ts";
import { FileQueue } from "../../utils/file-queue.ts";
import {
  formatErrorsPerFile,
  getErrors,
  getErrorsPerFile,
} from "../../utils/project-errors.ts";
import type { Project } from "../../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../../utils/statistics.ts";
import { FixErrorsAgent } from "./fix-errors.ts";

export class FixProjectErrorsAgent {
  private readonly project: Project;

  private constructor(project: Project) {
    this.project = project;
  }

  public static async run(project: Project): Promise<void> {
    const agent = new FixProjectErrorsAgent(project);

    agent.initializeStatistics();
    const startTime = performance.now();

    await agent.execute();

    const endTime = performance.now();
    agent.saveStatistics((endTime - startTime) / 1000);
  }

  private async execute(): Promise<void> {
    console.log("Checking for errors...");
    const errorsPerFile = await getErrorsPerFile(this.project);
    const errorFiles = Object.keys(errorsPerFile);
    if (errorFiles.length === 0) {
      console.log("No errors found.");
      return;
    }

    console.log(green(formatErrorsPerFile(errorsPerFile)));

    await this.fixErrorsInAllFiles(errorFiles);
    if ((await getErrors(this.project)).length > 0)
      await FixErrorsAgent.run(this.project);

    if ((await getErrors(this.project)).length === 0)
      console.log("All errors fixed.");
    else throw new Error("Some errors could not be fixed.");
  }

  private async fixErrorsInAllFiles(files: string[]): Promise<void> {
    const maxConcurrency = this.project.phase === 1 ? 10 : 1;
    console.log(`Processing files with max concurrency: ${maxConcurrency}`);

    const fileQueue = new FileQueue(this.project, files);
    const allAgents: Promise<void>[] = [];

    const agentCount = Math.min(maxConcurrency, files.length);
    for (let index = 0; index < agentCount; index += 1) {
      allAgents.push(this.processFileFromQueue(fileQueue, allAgents));
    }

    await Promise.all(allAgents);
  }

  private async processFileFromQueue(
    fileQueue: FileQueue,
    allAgents: Promise<void>[],
  ): Promise<void> {
    const file = fileQueue.shift();

    await FixErrorsAgent.run(this.project, file);
    fileQueue.markAsProcessed(file);

    if (fileQueue.hasUnprocessedFiles()) {
      const nextAgent = this.processFileFromQueue(fileQueue, allAgents);
      allAgents.push(nextAgent);
      await nextAgent;
    }
  }

  private initializeStatistics(): void {
    const stats = loadStatistics(this.project);
    const initialStats = {
      behaviorModificationsDetected: 0,
      costUsd: 0,
      files: {},
      initialErrorCount: 0,
      iterations: 0,
      remainingErrorCount: 0,
      timeSeconds: 0,
      turns: 0,
    };
    if (this.project.phase === 1) {
      if (!stats.phase1) throw new Error("Phase 1 statistics not initialized.");
      stats.phase1.steps.initialErrorFixing = initialStats;
    } else {
      if (!stats.phase2) throw new Error("Phase 2 statistics not initialized.");
      stats.phase2.steps.implicitAnyFixing = initialStats;
    }

    saveStatistics(this.project, stats);
  }

  private saveStatistics(timeSeconds: number): void {
    const stats = loadStatistics(this.project);

    if (this.project.phase === 1) {
      if (!stats.phase1?.steps.initialErrorFixing)
        throw new Error("Phase 1 statistics not initialized.");

      stats.phase1.timeSeconds += timeSeconds;
      stats.phase1.steps.initialErrorFixing.timeSeconds = timeSeconds;
    } else {
      if (!stats.phase2?.steps.implicitAnyFixing)
        throw new Error("Phase 2 statistics not initialized.");

      stats.phase2.timeSeconds += timeSeconds;
      stats.phase2.steps.implicitAnyFixing.timeSeconds = timeSeconds;
    }

    saveStatistics(this.project, stats);
  }
}
