import { AnalysisError, type AnalyzeInput } from "./ai-shared";
import { analyzeWithClaude } from "./claude";
import { analyzeWithGemini, geminiKey } from "./gemini";
import type { AiVerdict } from "./schema";

export { AnalysisError, IMAGE_TYPES, type AnalyzeInput, type ImageType } from "./ai-shared";

export type Provider = "claude" | "gemini";

/** AI_PROVIDER wins if set; otherwise whichever key the server has, Claude first. */
export function activeProvider(): Provider | null {
  const forced = process.env.AI_PROVIDER;
  if (forced === "claude" || forced === "gemini") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (geminiKey()) return "gemini";
  return null;
}

export const PROVIDER_LABEL: Record<Provider, string> = { claude: "Anthropic's Claude", gemini: "Google's Gemini" };

export async function analyzeMessage(input: AnalyzeInput): Promise<AiVerdict> {
  const provider = activeProvider();
  if (provider === "claude") return analyzeWithClaude(input);
  if (provider === "gemini") return analyzeWithGemini(input);
  throw new AnalysisError("No AI key is set on the server.", "config");
}
