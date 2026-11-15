import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AnalysisError, buildInstructions, SYSTEM_PROMPT, type AnalyzeInput } from "./ai-shared";
import { AiVerdictSchema, type AiVerdict } from "./schema";

/**
 * Fast and reliable on the free tier first, a larger model as backup. GEMINI_MODEL (or a
 * comma-separated GEMINI_MODELS) puts other models in front, e.g. "gemini-4-hydrogen".
 */
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];
const FIRST_TIMEOUT_MS = 15_000; // the fast model answers in about 2 s when healthy
const LATER_TIMEOUT_MS = 30_000; // larger models can take 20 s or more on the free tier
const COOLDOWN_MS = 5 * 60 * 1000;
const OVERLOAD_RETRY_DELAY_MS = 800;

export function geminiModels(): string[] {
  const configured = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_MODELS])];
}

/** Models that just failed with overload or quota errors are skipped for a few minutes. */
const coolingDown = new Map<string, number>();

/**
 * overloaded (500/502/503): Google says "try again"; retry the same model once, no cooldown.
 * unavailable (404, 429 quota, 504 or our own timeout): move on and skip this model for a while.
 * fatal (bad key, unusable answer): stop; another model would fail the same way.
 */
function classify(error: unknown): "overloaded" | "unavailable" | "fatal" {
  if (error instanceof AnalysisError) return "fatal";
  if (error instanceof ApiError) {
    if ([500, 502, 503].includes(error.status)) return "overloaded";
    if ([404, 429, 504].includes(error.status)) return "unavailable";
    return "fatal";
  }
  return "unavailable";
}

export function resetGeminiCooldowns(): void {
  coolingDown.clear();
}

// The Gemini API accepts a subset of JSON Schema; "$schema" is not part of it.
const { $schema: _unused, ...RESPONSE_SCHEMA } = z.toJSONSchema(AiVerdictSchema) as Record<string, unknown>;

let client: GoogleGenAI | null = null;

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function getClient(): GoogleGenAI {
  const apiKey = geminiKey();
  if (!apiKey) throw new AnalysisError("GEMINI_API_KEY is not set on the server.", "config");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

async function callModel(model: string, input: AnalyzeInput, timeoutMs: number): Promise<AiVerdict> {
  const response = await getClient().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          ...(input.image ? [{ inlineData: { mimeType: input.image.mediaType, data: input.image.data } }] : []),
          { text: buildInstructions(input) },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });

  if (response.promptFeedback?.blockReason) {
    throw new AnalysisError(`Gemini blocked the request (${response.promptFeedback.blockReason}).`, "refused");
  }
  const text = response.text;
  if (!text) throw new AnalysisError(`Gemini returned no text (${response.candidates?.[0]?.finishReason ?? "unknown"}).`, "failed");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AnalysisError("Gemini returned invalid JSON.", "failed");
  }
  const parsed = AiVerdictSchema.safeParse(json);
  if (!parsed.success) throw new AnalysisError(`Gemini's answer didn't match the schema: ${parsed.error.issues[0]?.message}`, "failed");
  return parsed.data;
}

/** Same contract as the Claude path: one structured verdict, from the first model that answers. */
export async function analyzeWithGemini(
  input: AnalyzeInput,
  { now = Date.now, sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) } = {},
): Promise<AiVerdict> {
  const models = geminiModels();
  const ready = models.filter((model) => (coolingDown.get(model) ?? 0) <= now());
  let lastError: unknown;

  attempts: for (const [index, model] of (ready.length ? ready : models).entries()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(model, input, index === 0 ? FIRST_TIMEOUT_MS : LATER_TIMEOUT_MS);
      } catch (error) {
        lastError = error;
        const detail = error instanceof ApiError ? `status ${error.status}` : error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        console.warn(`gemini ${model} failed: ${detail.slice(0, 200)}`);
        const kind = classify(error);
        if (kind === "fatal") break attempts;
        if (kind === "overloaded" && attempt === 0) {
          await sleep(OVERLOAD_RETRY_DELAY_MS);
          continue;
        }
        if (kind === "unavailable") coolingDown.set(model, now() + COOLDOWN_MS);
        break;
      }
    }
  }

  if (lastError instanceof AnalysisError) throw lastError;
  if (lastError instanceof ApiError) {
    if (lastError.status === 400 && /api key/i.test(lastError.message)) throw new AnalysisError("The server's Gemini key was rejected.", "config");
    if (lastError.status === 401 || lastError.status === 403) throw new AnalysisError("The server's Gemini key was rejected.", "config");
    if (lastError.status === 429 || lastError.status >= 500) throw new AnalysisError(`Gemini is busy (${lastError.status}).`, "busy");
    throw new AnalysisError(`Gemini request failed (${lastError.status}).`, "failed");
  }
  throw new AnalysisError("Gemini request failed.", "failed");
}
