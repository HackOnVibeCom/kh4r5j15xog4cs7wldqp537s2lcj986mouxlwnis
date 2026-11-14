import { describe, expect, it, vi } from "vitest";
import { mergeResult, runCheck } from "@/lib/check";
import type { LinkReport } from "@/lib/schema";
import { cleanVerdict, scamVerdict } from "./fixtures";

const NOW = new Date("2026-11-14T12:00:00Z");

function link(overrides: Partial<LinkReport>): LinkReport {
  return { url: "x.top", hostname: "x.top", domain: "x.top", registered: null, ageDays: null, lookup: "unavailable", ...overrides };
}

describe("mergeResult", () => {
  it("keeps the AI's flags and labels them as AI readings", () => {
    const result = mergeResult(scamVerdict, [], NOW);
    expect(result.verdict).toBe("likely_scam");
    expect(result.flags.every((flag) => flag.source === "ai")).toBe(true);
  });

  it("adds a registry fact for a brand-new domain and raises a clean verdict to suspicious", () => {
    const result = mergeResult(cleanVerdict, [link({ lookup: "found", ageDays: 3, registered: "2026-11-11T00:00:00Z" })], NOW);
    expect(result.verdict).toBe("suspicious");
    expect(result.flags).toEqual([
      expect.objectContaining({ source: "domain_registry", reason: expect.stringContaining("3 days ago") }),
    ]);
  });

  it("never lowers the AI's verdict, and old domains add nothing", () => {
    const result = mergeResult(scamVerdict, [link({ lookup: "found", ageDays: 4000 })], NOW);
    expect(result.verdict).toBe("likely_scam");
    expect(result.flags.filter((flag) => flag.source !== "ai")).toEqual([]);
  });

  it("a URL shortener alone does not raise the verdict", () => {
    const result = mergeResult(cleanVerdict, [link({ url: "bit.ly/x", hostname: "bit.ly", domain: "bit.ly", lookup: "found", ageDays: 5000 })], NOW);
    expect(result.verdict).toBe("no_red_flags");
    expect(result.flags[0].source).toBe("link_check");
  });
});

describe("runCheck", () => {
  it("looks up links from the text and from the AI's transcription of a screenshot", async () => {
    const reportLinks = vi.fn(async (links: Array<{ url: string; hostname: string; domain: string }>) =>
      links.map((l) => ({ ...l, registered: null, ageDays: null, lookup: "unavailable" as const })),
    );
    const analyze = vi.fn(async () => scamVerdict);

    const result = await runCheck(
      { image: { data: "aGk=", mediaType: "image/png" }, uiLanguage: "en" },
      { analyze, reportLinks, now: () => NOW },
    );

    expect(analyze).toHaveBeenCalledOnce();
    expect(reportLinks).toHaveBeenLastCalledWith([expect.objectContaining({ domain: "bses-bill-update.top" })]);
    expect(result.links.map((l) => l.domain)).toEqual(["bses-bill-update.top"]);
    expect(result.checkedAt).toBe(NOW.toISOString());
  });
});
