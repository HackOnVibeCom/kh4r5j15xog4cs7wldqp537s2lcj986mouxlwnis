import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleResult } from "./fixtures";

const runCheck = vi.fn();
vi.mock("@/lib/check", () => ({ runCheck: (...args: unknown[]) => runCheck(...args) }));

const { POST } = await import("@/app/api/check/route");
const { AnalysisError } = await import("@/lib/analyze");
const { verifyShare } = await import("@/lib/token");

let ip = 0;
function post(body: unknown): Request {
  ip += 1; // fresh client each time so the rate limiter doesn't interfere
  return new Request("http://localhost/api/check", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ip}` },
    body: JSON.stringify(body),
  });
}

describe("POST /api/check", () => {
  beforeEach(() => {
    runCheck.mockReset();
  });

  it("returns a verdict and a signed warning link token", async () => {
    runCheck.mockResolvedValue(sampleResult);
    const res = await POST(post({ text: "Your power will be cut tonight", uiLanguage: "en-IN" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.verdict).toBe("likely_scam");
    expect(verifyShare(json.token)).toEqual(sampleResult);
    expect(runCheck).toHaveBeenCalledWith({ text: "Your power will be cut tonight", image: undefined, uiLanguage: "en-IN" });
  });

  it("rejects an empty request", async () => {
    const res = await POST(post({ text: "   " }));
    expect(res.status).toBe(400);
    expect(runCheck).not.toHaveBeenCalled();
  });

  it("rejects unsupported image types", async () => {
    const res = await POST(post({ image: { data: "aGk=", mediaType: "image/svg+xml" } }));
    expect(res.status).toBe(400);
  });

  it("turns AI failures into a friendly message", async () => {
    runCheck.mockImplementation(async () => {
      throw new AnalysisError("rate limited", "busy");
    });
    const res = await POST(post({ text: "hello" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/try again/i);
  });

  it("rate limits a single client", async () => {
    runCheck.mockResolvedValue(sampleResult);
    const make = () =>
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "192.168.1.1" },
        body: JSON.stringify({ text: "hi" }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) statuses.push((await POST(make())).status);
    expect(statuses.slice(0, 12).every((s) => s === 200)).toBe(true);
    expect(statuses[12]).toBe(429);
  });
});
