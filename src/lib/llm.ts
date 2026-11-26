import { ChatGroq } from "@langchain/groq";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export type LlmConfig = { apiKey?: string; model?: string };

/**
 * Reads the BYOK Groq key + model passed per request in `configurable`. Never persisted.
 * The key is nested in an object so tracing (LangSmith) never copies it into run metadata.
 */
export function llmFromConfig(config?: LangGraphRunnableConfig, opts?: { streaming?: boolean; temperature?: number }) {
  const apiKey = (config?.configurable?.secrets as { groqApiKey?: string } | undefined)?.groqApiKey;
  const model = (config?.configurable?.model as string | undefined) || DEFAULT_MODEL;
  if (!apiKey) return null;
  return new ChatGroq({
    apiKey,
    model,
    temperature: opts?.temperature ?? 0.4,
    streaming: opts?.streaming ?? false,
    maxRetries: 1,
  });
}

export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) => (typeof c === "string" ? c : (c as { text?: string })?.text ?? ""))
      .join("");
  return "";
}

/** Strips <think>…</think> blocks that some reasoning models emit. */
export function stripThinking(s: string) {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export function readKey(req: Request) {
  const key = req.headers.get("x-groq-api-key")?.trim();
  return key && key.length > 10 ? key : undefined;
}
