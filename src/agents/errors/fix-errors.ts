import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { claudeCode, ClaudePromptLimitError } from "../../utils/claude-code.ts";
import { red } from "../../utils/console-colors.ts";
import { formatErrorsWithContext } from "../../utils/error-formatting.ts";
import { FileModificationHookState } from "../../utils/file-modification-hook.ts";
import { getErrors, type ProjectError } from "../../utils/project-errors.ts";
import type { Project } from "../../utils/project-workdir.ts";
import { loadStatistics, saveStatistics } from "../../utils/statistics.ts";

const MAX_ITERATIONS_PER_100_ERRORS = 5;

export class FixErrorsAgent {
  private readonly project: Project;
  private readonly filePath: string | undefined;
  private readonly scope: string;
  private readonly hookState: FileModificationHookState;

  private sessionId?: string;
  private readonly stats = {
    behaviorModificationsDetected: 0,
    costUsd: 0,
    initialErrorCount: 0,
    iterations: 0,
    remainingErrorCount: 0,
    timeSeconds: 0,
    turns: 0,
  };

  private constructor(project: Project, filePath: string | undefined) {
    this.project = project;
    this.filePath = filePath;
    this.scope = this.filePath ?? "the project";
    this.hookState = new FileModificationHookState(project);
  }

  public static async run(project: Project, filePath?: string): Promise<void> {
    const agent = new FixErrorsAgent(project, filePath);
    const startTime = performance.now();
    await agent.execute();
    const endTime = performance.now();
    agent.saveStats((endTime - startTime) / 1000);
  }

  private async execute(): Promise<void> {
    console.log(`Fixing errors in ${this.scope}...`);
    const errors = await this.checkErrors();
    if (errors.length > 0) await this.runFixingIterations(errors);
  }

  // eslint-disable-next-line max-statements
  private async runFixingIterations(
    initialErrors: ProjectError[],
  ): Promise<void> {
    this.stats.initialErrorCount = initialErrors.length;
    let errors = initialErrors;
    const maxIterations = calculateMaxIterations(initialErrors.length);
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      this.stats.iterations = iteration;
      await this.fixErrors(errors);
      errors = await this.checkErrors();
      this.stats.remainingErrorCount = errors.length;
      if (errors.length === 0) return;
      if (iteration % MAX_ITERATIONS_PER_100_ERRORS === 0)
        delete this.sessionId;
    }
    console.log(
      red(
        `Failed to fix all errors in ${this.scope} after ${maxIterations} iterations. ${errors.length} error(s) remaining.`,
      ),
    );
  }

  private async checkErrors(): Promise<ProjectError[]> {
    const errors = await getErrors(this.project, this.filePath);
    if (errors.length === 0) {
      console.log(`All errors in ${this.scope} have been fixed.`);
    }
    return errors;
  }

  private async fixErrors(errors: ProjectError[]): Promise<void> {
    const formattedErrors = formatErrorsWithContext(errors, this.project);
    const prompt = await this.buildPrompt(formattedErrors);
    try {
      await this.runClaudeCode(prompt);
    } catch (error) {
      await this.handleClaudeError(error);
    }
  }

  private async buildPrompt(formattedErrors: string): Promise<string> {
    let prompt: string;
    if (this.project.phase === 1) {
      prompt = await this.buildPhase1Prompt(formattedErrors);
    } else {
      prompt = await this.buildPhase2Prompt(formattedErrors);
    }
    return prompt;
  }

  private async buildPhase1Prompt(formattedErrors: string): Promise<string> {
    if (typeof this.sessionId === "undefined") {
      const promptTemplate = await this.loadPromptTemplate(1);
      return `You are establishing a zero errors baseline for ${this.scope}.\n${promptTemplate}\n${formattedErrors}`;
    }

    return `Not all errors are fixed in ${this.scope}. Here are the remaining errors:\n\n${formattedErrors}`;
  }

  private async buildPhase2Prompt(formattedErrors: string): Promise<string> {
    if (typeof this.filePath === "string") {
      if (typeof this.sessionId === "undefined") {
        const promptTemplate = await this.loadPromptTemplate(2);
        return `You are improving TypeScript 'any' coverage for ${this.scope}.\n${promptTemplate}\n${formattedErrors}`;
      } else if (this.stats.iterations % MAX_ITERATIONS_PER_100_ERRORS === 2) {
        return `Not all errors are fixed in ${this.scope}. Fix remaining errors by refining the type definitions you just created or addressing newly discovered issues. Here are the remaining errors:\n\n${formattedErrors}`;
      }
    } else if (typeof this.sessionId === "undefined") {
      const promptTemplate = await this.loadPromptTemplate(1);
      return `You are resolving type errors which were caused by adding type annotations to the project. Review and fix the existing type annotations.\n${promptTemplate}\n${formattedErrors}`;
    }

    return `Not all errors are fixed in ${this.scope}. Here are the remaining errors:\n\n${formattedErrors}`;
  }

  private async loadPromptTemplate(phase: number): Promise<string> {
    const promptFileName = `phase${phase}-${this.project.language}.md`;
    const promptPath = join(import.meta.dirname, "prompts", promptFileName);
    return readFile(promptPath, "utf-8");
  }

  private async runClaudeCode(prompt: string): Promise<void> {
    const options: Options = {
      cwd: this.project.path,
      permissionMode: "acceptEdits",
      hooks: this.hookState.hooks,
    };
    if (typeof this.sessionId === "string") {
      options.resume = this.sessionId;
    }
    const verbose = this.project.phase === 2;
    const { sessionId, costUsd, turns } = await claudeCode(
      prompt,
      options,
      verbose,
    );
    this.sessionId = sessionId;
    this.stats.turns += turns;
    this.stats.costUsd += costUsd;
    this.stats.behaviorModificationsDetected =
      this.hookState.behaviorModificationsDetected;
  }

  private async handleClaudeError(error: unknown): Promise<void> {
    if (
      error instanceof ClaudePromptLimitError &&
      typeof this.filePath === "string"
    ) {
      const fileContent = await readFile(this.filePath, "utf-8");
      const contentWithNoCheck = `// @ts-nocheck\n${fileContent}`;
      await writeFile(this.filePath, contentWithNoCheck, "utf-8");
    } else throw error;
  }

  private saveStats(timeSeconds: number): void {
    const stats = loadStatistics(this.project);
    const aggregate =
      this.project.phase === 1
        ? stats.phase1?.steps.initialErrorFixing
        : stats.phase2?.steps.implicitAnyFixing;

    if (!aggregate) throw new Error("Statistics not initialized.");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    for (const key of Object.keys(this.stats) as (keyof typeof this.stats)[]) {
      aggregate[key] += this.stats[key];
    }

    this.stats.timeSeconds = timeSeconds;
    if (typeof this.filePath === "string") {
      aggregate.files[this.filePath] = this.stats;
    } else {
      aggregate.finalCleanup = this.stats;
    }

    saveStatistics(this.project, stats);
  }
}

function calculateMaxIterations(initialErrorCount: number): number {
  if (initialErrorCount < 100) return MAX_ITERATIONS_PER_100_ERRORS;
  return Math.floor((initialErrorCount * MAX_ITERATIONS_PER_100_ERRORS) / 100);
}
