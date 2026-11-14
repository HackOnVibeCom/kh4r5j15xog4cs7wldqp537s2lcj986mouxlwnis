import { describe, expect, it } from "vitest";
import { highlight } from "@/lib/highlight";

describe("highlight", () => {
  it("splits text around each found quote, in reading order", () => {
    const segments = highlight("Pay now or your account closes today.", ["account closes today", "Pay now"]);
    expect(segments).toEqual([
      { text: "Pay now", flag: 1 },
      { text: " or your ", flag: null },
      { text: "account closes today", flag: 0 },
      { text: ".", flag: null },
    ]);
  });

  it("falls back to a case-insensitive match and skips quotes it can't find", () => {
    expect(highlight("URGENT: reply", ["urgent", "missing"])).toEqual([
      { text: "URGENT", flag: 0 },
      { text: ": reply", flag: null },
    ]);
  });

  it("ignores overlapping and very short quotes", () => {
    expect(highlight("abcdef", ["abcd", "cdef", "ab"])).toEqual([
      { text: "abcd", flag: 0 },
      { text: "ef", flag: null },
    ]);
  });
});
