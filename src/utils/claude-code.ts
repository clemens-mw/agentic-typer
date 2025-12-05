/* eslint-disable max-classes-per-file */

import {
  query,
  type Options,
  type SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { cyan, green, red } from "./console-colors.ts";

export interface ClaudeResult {
  costUsd: number;
  durationSeconds: number;
  result: string;
  sessionId: string;
  turns: number;
}

export class ClaudeSessionLimitError extends Error {}
export class ClaudePromptLimitError extends Error {}

export async function claudeCode(
  prompt: string,
  options?: Options,
  verbose = false,
): Promise<ClaudeResult> {
  let shouldContinueAfterError = false;
  for await (const message of query({ prompt, options: { ...options } })) {
    if (verbose) logMessage(message);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (message.type === "assistant" && isErrorAndMayContinue(message.message))
      shouldContinueAfterError = true;

    if (message.type === "result" && message.subtype === "success") {
      let result = {
        costUsd: message.total_cost_usd,
        durationSeconds: message.duration_ms / 1000,
        result: message.result,
        sessionId: message.session_id,
        turns: message.num_turns,
      };
      if (shouldContinueAfterError)
        result = await continueAfterError(result, options, verbose);
      return result;
    }
  }
  throw new Error("Claude API query failed");
}

function isErrorAndMayContinue(message: AssistantMessage): boolean {
  if (assistantMessageStartsWith("API Error: 400", message)) return true;

  if (assistantMessageStartsWith("Session limit reached", message))
    throw new ClaudeSessionLimitError("Claude session limit reached");

  if (assistantMessageStartsWith("Weekly limit reached", message))
    throw new ClaudeSessionLimitError("Claude weekly limit reached");

  if (assistantMessageStartsWith("Usage limit reached", message))
    throw new ClaudeSessionLimitError("Claude usage limit reached");

  if (assistantMessageStartsWith("Prompt is too long", message))
    throw new ClaudePromptLimitError("Prompt is too long");

  return false;
}

function assistantMessageStartsWith(
  prefix: string,
  message: AssistantMessage,
): boolean {
  const [content] = message.content;
  if (content.type === "text" && content.text.startsWith(prefix)) return true;
  return false;
}

async function continueAfterError(
  intermediateResult: ClaudeResult,
  options?: Options,
  verbose?: boolean,
): Promise<ClaudeResult> {
  console.log(red("Claude API Error detected, continuing the session..."));
  const newOptions = { ...options, resume: intermediateResult.sessionId };
  const continueResult = await claudeCode("Continue", newOptions, verbose);
  continueResult.costUsd += intermediateResult.costUsd;
  continueResult.durationSeconds += intermediateResult.durationSeconds;
  return continueResult;
}

function logMessage(message: SDKMessage): void {
  switch (message.type) {
    case "user":
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console.log(`> USER: ${formatUserMessage(message.message)}`);
      break;
    case "assistant":
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console.log(`> ASSISTANT: ${formatAssistantMessage(message.message)}`);
      break;
    case "result":
      console.log(`> RESULT: ${formatResultMessage(message)}`);
      break;
    case "system":
      console.log(`> SYSTEM: ${message.subtype}`);
      break;
    case "stream_event":
    case "tool_progress":
    case "auth_status":
      throw new Error(`Message type ${message.type} are not supported`);
    default:
      throw new Error("Unknown message type");
  }
}

function formatUserMessage(message: UserMessage): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (message.content.length !== 1) throw new Error(`Invalid user message`);
  const [content] = message.content;
  if (content.type === "text") return content.text;

  let text = content.content;
  if (content.content.length > 100) {
    text = `${content.content.slice(0, 100)}... (${content.content.length} characters)`;
  }
  return `${content.type}: ${text}`;
}

function formatAssistantMessage(message: AssistantMessage): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (message.content.length !== 1)
    throw new Error(`Invalid assistant message`);
  const [content] = message.content;
  switch (content.type) {
    case "tool_use":
      if (content.name === "TodoWrite")
        return `TodoWrite:\n${content.input.todos.map(formatTodo).join("\n")}`;
      return `${content.type}: ${green(content.name)}(${JSON.stringify(content.input)})`;
    case "text":
      return green(content.text);
    case "thinking":
      return cyan(content.thinking);
    default:
      throw new Error(`Unknown assistant message content type`);
  }
}

function formatTodo(todo: Todo): string {
  switch (todo.status) {
    case "completed":
      return `✅ ${todo.content}`;
    case "in_progress":
      return `🔄 ${todo.activeForm}`;
    case "pending":
      return `☑️  ${todo.content}`;
    default:
      throw new Error(`Unknown todo status`);
  }
}

function formatResultMessage(message: SDKResultMessage): string {
  const cost = message.total_cost_usd.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });
  const firstLine =
    `${message.subtype} | ` +
    `Duration: ${(message.duration_ms / 1000).toFixed(2)}s | ` +
    `Cost: ${cost} | ` +
    `Turns: ${message.num_turns}\n`;
  if (message.subtype === "success")
    return `${firstLine + green(message.result)}\n`;
  return firstLine;
}

interface TextMessageContent {
  type: "text";
  text: string;
}

interface UserMessage {
  role: "user";
  content: [UserMessageContent | TextMessageContent];
}

interface UserMessageContent {
  type: "tool_result";
  // eslint-disable-next-line @typescript-eslint/naming-convention
  tool_use_id: string;
  content: string;
}

interface AssistantMessage {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: [AssistantMessageContent];
}

type AssistantMessageContent =
  | TextMessageContent
  | AssistantThinkingMessageContent
  | AssistantToolUseMessageContent
  | AssistantTodoWriteMessageContent;

interface AssistantThinkingMessageContent {
  type: "thinking";
  thinking: string;
  signature: string;
}

interface AssistantToolUseMessageContent {
  type: "tool_use";
  id: string;
  name: "Bash" | "Glob" | "Read";
  input: object;
}

interface AssistantTodoWriteMessageContent {
  type: "tool_use";
  id: string;
  name: "TodoWrite";
  input: { todos: Todo[] };
}

interface Todo {
  content: string;
  status: "in_progress" | "pending" | "completed";
  activeForm: string;
}
