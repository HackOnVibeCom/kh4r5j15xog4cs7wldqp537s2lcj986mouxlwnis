import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AnalysisError, buildInstructions, SYSTEM_PROMPT, type AnalyzeInput } from "./ai-shared";
import { AiVerdictSchema, type AiVerdict } from "./schema";

/**
 * "Latest" aliases follow Google's current models, so the app keeps working when versions change.
 * Flash-Lite has a much larger free daily quota, so it takes over when Flash runs out.
 */
export const GEMINI_MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];

// The Gemini API accepts a subset of JSON Schema; "$schema" is not part of it.
const { $schema: _unused, ...RESPONSE_SCHEMA } = z.toJSONSchema(AiVerdictSchema) as Record<string, unknown>;

let client: GoogleGenAI | null = null;

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function getClient(): GoogleGenAI {
  const apiKey = geminiKey();
  if (!apiKey) throw new AnalysisError("GEMINI_API_KEY is not set on the server.", "config");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 45_000 } });
  return client;
}

async function callModel(model: string, input: AnalyzeInput): Promise<AiVerdict> {
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

/** Same contract as the Claude path: one call, one structured verdict. */
export async function analyzeWithGemini(input: AnalyzeInput): Promise<AiVerdict> {
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      return await callModel(model, input);
    } catch (error) {
      lastError = error;
      // Out of quota (429) or model not available here (404): try the next model.
      if (error instanceof ApiError && (error.status === 429 || error.status === 404)) continue;
      break;
    }
  }

  if (lastError instanceof AnalysisError) throw lastError;
  if (lastError instanceof ApiError) {
    if (lastError.status === 400 && /api key/i.test(lastError.message)) throw new AnalysisError("The server's Gemini key was rejected.", "config");
    if (lastError.status === 401 || lastError.status === 403) throw new AnalysisError("The server's Gemini key was rejected.", "config");
    if (lastError.status === 429) throw new AnalysisError("Gemini's free quota is used up for now.", "busy");
    throw new AnalysisError(`Gemini request failed (${lastError.status}).`, "failed");
  }
  throw new AnalysisError("Gemini request failed.", "failed");
}
