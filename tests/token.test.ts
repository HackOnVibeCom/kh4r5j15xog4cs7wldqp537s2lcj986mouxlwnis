import { describe, expect, it } from "vitest";
import { signShare, verifyShare } from "@/lib/token";
import { sampleResult } from "./fixtures";

const SECRET = "test-secret";

describe("warning link tokens", () => {
  it("round-trips a verdict", () => {
    const token = signShare(sampleResult, SECRET);
    expect(verifyShare(token, SECRET)).toEqual(sampleResult);
  });

  it("rejects a forged verdict", () => {
    const token = signShare(sampleResult, SECRET);
    const forged = signShare({ ...sampleResult, verdict: "no_red_flags" }, "attacker-secret");
    const [forgedData] = forged.split("~");
    const [, realSignature] = token.split("~");
    expect(verifyShare(`${forgedData}~${realSignature}`, SECRET)).toBeNull();
    expect(verifyShare(forged, SECRET)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyShare("nonsense", SECRET)).toBeNull();
    expect(verifyShare("a~b~c", SECRET)).toBeNull();
  });

  it("trims long messages so links stay short", () => {
    const long = { ...sampleResult, message: "x".repeat(10_000) };
    const decoded = verifyShare(signShare(long, SECRET), SECRET);
    expect(decoded?.message).toHaveLength(1500);
  });
});
