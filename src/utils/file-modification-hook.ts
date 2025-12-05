import type {
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  Options,
  PostToolUseHookInput,
  PreToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";
import { createPatch } from "diff";
import { isAbsolute, resolve } from "path";
import { red } from "./console-colors.ts";
import type { Project } from "./project-workdir.ts";
import { transpile } from "./typescript.ts";

const original = new Map<string, string>();

export class FileModificationHookState {
  public readonly hooks: NonNullable<Options["hooks"]>;
  public behaviorModificationsDetected = 0;

  private readonly project: Project;

  public constructor(project: Project) {
    this.project = project;
    const hook = this.createHook();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.hooks = { PreToolUse: hook, PostToolUse: hook };
  }

  private createHook(): HookCallbackMatcher[] {
    const hook = async (input: HookInput): Promise<HookJSONOutput> => {
      try {
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (input.hook_event_name) {
          case "PreToolUse":
            return await this.handlePreToolUseEvent(input);
          case "PostToolUse":
            return await this.handlePostToolUseEvent(input);
          default:
            return {};
        }
      } catch (error) {
        if (error instanceof Error)
          console.error(red(`Error in file modification hook: ${error}`));
        else
          console.error(red("Error in file modification hook: Unknown error"));
        return {};
      }
    };
    return [{ hooks: [hook] }];
  }

  private async handlePreToolUseEvent(
    input: PreToolUseHookInput,
  ): Promise<HookJSONOutput> {
    if (!isFileModificationTool(input.tool_name)) return {};

    const filePath = this.extractFilePath(input.tool_input);
    if (!original.has(filePath)) {
      const transpiled = await transpile(filePath, this.project);
      original.set(filePath, transpiled);
    }

    return {};
  }

  private async handlePostToolUseEvent(
    input: PostToolUseHookInput,
  ): Promise<HookJSONOutput> {
    if (!isFileModificationTool(input.tool_name)) return {};

    const filePath = this.extractFilePath(input.tool_input);
    const diff = await this.detectRuntimeChange(filePath);
    if (typeof diff !== "string") return {};
    this.behaviorModificationsDetected += 1;

    const additionalContext =
      `CRITICAL: You modified the runtime behavior in '${filePath}'.\n\n` +
      `You MUST NOT change any code logic.\n\n` +
      `Here is the diff showing the runtime changes you made:\n\n<diff>\n${diff}</diff>\n\n` +
      `Revert ALL runtime changes immediately.`;
    return {
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext },
    };
  }

  private extractFilePath(toolInput: unknown): string {
    if (
      typeof toolInput === "object" &&
      toolInput !== null &&
      "file_path" in toolInput &&
      typeof toolInput.file_path === "string"
    ) {
      const filePathValue = toolInput.file_path;
      return isAbsolute(filePathValue)
        ? filePathValue
        : resolve(this.project.path, filePathValue);
    }
    throw new Error("Invalid tool input: missing file_path");
  }

  private async detectRuntimeChange(filePath: string): Promise<string | null> {
    const originalCode = original.get(filePath);
    if (typeof originalCode !== "string")
      throw new Error(`Missing original code for ${filePath}`);

    const currentCode = await transpile(filePath, this.project);
    if (originalCode === currentCode) return null;

    return createPatch(
      filePath,
      originalCode,
      currentCode,
      "original",
      "modified",
    );
  }
}

function isFileModificationTool(toolName: string): boolean {
  const fileModificationTools = ["Edit", "MultiEdit"];
  return fileModificationTools.includes(toolName);
}
