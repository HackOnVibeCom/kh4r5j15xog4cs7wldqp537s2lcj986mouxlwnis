import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnalysisError, buildInstructions, SYSTEM_PROMPT, type AnalyzeInput } from "./ai-shared";
import { AiVerdictSchema, type AiVerdict } from "./schema";

export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnalysisError("ANTHROPIC_API_KEY is not set on the server.", "config");
  }
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

/** One Claude call: reads the message (text and/or screenshot) and returns a structured verdict. */
export async function analyzeWithClaude(input: AnalyzeInput): Promise<AiVerdict> {
  try {
    const response = await getClient().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "low", format: zodOutputFormat(AiVerdictSchema) },
      messages: [
        {
          role: "user",
          content: [
            ...(input.image
              ? [
                  {
                    type: "image" as const,
                    source: { type: "base64" as const, media_type: input.image.mediaType, data: input.image.data },
                  },
                ]
              : []),
            { type: "text" as const, text: buildInstructions(input) },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new AnalysisError("The model declined to analyze this message.", "refused");
    }
    if (!response.parsed_output) {
      throw new AnalysisError(`No structured verdict (stop_reason: ${response.stop_reason}).`, "failed");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new AnalysisError("The server's API key was rejected.", "config");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AnalysisError("The AI is busy right now.", "busy");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AnalysisError(`AI request failed (${error.status ?? "network"}).`, "failed");
    }
    throw new AnalysisError("AI request failed.", "failed");
  }
}
