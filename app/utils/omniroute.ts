// OmniRoute API client — Enhanced with retry, timeout, mock fallback, and telemetry
import { executeAiCompletion, AiCompletionOptions } from "../../lib/ai/ai-client";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: string };
  timeoutMs?: number;
  maxRetries?: number;
  useMock?: boolean;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
  latencyMs?: number;
  isMock?: boolean;
}

export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const result = await executeAiCompletion({
    model: options.model,
    messages: options.messages,
    max_tokens: options.max_tokens,
    temperature: options.temperature,
    response_format: options.response_format,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    useMock: options.useMock,
  });

  return {
    choices: [
      {
        message: {
          content: result.content,
        },
      },
    ],
    latencyMs: result.latencyMs,
    isMock: result.isMock,
  };
}
