import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scamVerdict } from "./fixtures";

const generateContent = vi.fn();

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

const { ApiError } = await import("@google/genai");
const { analyzeWithGemini, geminiModels, resetGeminiCooldowns } = await import("@/lib/gemini");
const { activeProvider } = await import("@/lib/analyze");
const { AnalysisError } = await import("@/lib/ai-shared");

const input = { text: "Your power will be cut tonight", uiLanguage: "en" };
const ok = (body: unknown) => ({ text: JSON.stringify(body), candidates: [{ finishReason: "STOP" }] });

describe("analyzeWithGemini", () => {
  beforeEach(() => {
    generateContent.mockReset();
    resetGeminiCooldowns();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GEMINI_MODELS", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends the schema and returns a validated verdict", async () => {
    generateContent.mockResolvedValue(ok(scamVerdict));
    await expect(analyzeWithGemini(input)).resolves.toEqual(scamVerdict);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe(geminiModels()[0]);
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.responseJsonSchema).not.toHaveProperty("$schema");
    expect(request.contents[0].parts.at(-1).text).toContain("<message>");
  });

  it("falls back to the next model when the free quota runs out", async () => {
    generateContent
      .mockRejectedValueOnce(new ApiError({ message: "quota", status: 429 }))
      .mockResolvedValueOnce(ok(scamVerdict));
    await expect(analyzeWithGemini(input)).resolves.toEqual(scamVerdict);
    expect(generateContent.mock.calls.map((call) => call[0].model)).toEqual(geminiModels());
  });

  it("falls back on timeouts and overload, then skips the failing model for a while", async () => {
    generateContent
      .mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"))
      .mockResolvedValueOnce(ok(scamVerdict))
      .mockResolvedValueOnce(ok(scamVerdict));
    await analyzeWithGemini(input);
    await analyzeWithGemini(input);
    const [first, second] = geminiModels();
    expect(generateContent.mock.calls.map((call) => call[0].model)).toEqual([first, second, second]);
  });

  it("retries an overloaded model once before moving on, without benching it", async () => {
    generateContent
      .mockRejectedValueOnce(new ApiError({ message: "high demand", status: 503 }))
      .mockResolvedValueOnce(ok(scamVerdict))
      .mockResolvedValueOnce(ok(scamVerdict));
    const sleep = vi.fn(async () => {});
    await analyzeWithGemini(input, { sleep });
    await analyzeWithGemini(input, { sleep });
    const [first] = geminiModels();
    expect(generateContent.mock.calls.map((call) => call[0].model)).toEqual([first, first, first]);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("puts a configured model such as Hydrogen first", () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-4-hydrogen");
    expect(geminiModels()[0]).toBe("gemini-4-hydrogen");
    expect(geminiModels()).toHaveLength(3);
  });

  it("reports 'busy' when every model is out of quota", async () => {
    generateContent.mockImplementation(async () => {
      throw new ApiError({ message: "quota", status: 429 });
    });
    await expect(analyzeWithGemini(input)).rejects.toMatchObject({ kind: "busy" });
  });

  it("rejects answers that don't match the schema", async () => {
    generateContent.mockResolvedValue(ok({ verdict: "safe" }));
    const error = await analyzeWithGemini(input).catch((e) => e);
    expect(error).toBeInstanceOf(AnalysisError);
    expect(error.kind).toBe("failed");
  });

  it("treats a rejected key as a setup problem, without trying other models", async () => {
    generateContent.mockImplementation(async () => {
      throw new ApiError({ message: "API key not valid", status: 400 });
    });
    await expect(analyzeWithGemini(input)).rejects.toMatchObject({ kind: "config" });
    expect(generateContent).toHaveBeenCalledOnce();
  });
});

describe("activeProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers Claude when both keys exist, and honours AI_PROVIDER", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "a");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(activeProvider()).toBe("claude");
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(activeProvider()).toBe("gemini");
  });

  it("uses Gemini when only a Gemini key exists, and nothing when no key exists", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(activeProvider()).toBe("gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    expect(activeProvider()).toBeNull();
  });
});
