import { describe, expect, it } from "vitest";
import { lookupDomainAge, parseRegistration } from "@/lib/rdap";

const NOW = Date.parse("2026-11-14T12:00:00Z");

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe("parseRegistration", () => {
  it("reads the registration event", () => {
    const body = {
      events: [
        { eventAction: "last changed", eventDate: "2026-11-01T00:00:00Z" },
        { eventAction: "registration", eventDate: "2026-11-10T08:00:00Z" },
      ],
    };
    expect(parseRegistration(body)).toBe("2026-11-10T08:00:00.000Z");
  });

  it("returns null for missing or malformed data", () => {
    expect(parseRegistration(null)).toBeNull();
    expect(parseRegistration({ events: [{ eventAction: "registration", eventDate: "not a date" }] })).toBeNull();
  });
});

describe("lookupDomainAge", () => {
  it("computes age in days from the registry", async () => {
    const result = await lookupDomainAge("new-scam-site-1.top", {
      fetchImpl: fakeFetch(200, { events: [{ eventAction: "registration", eventDate: "2026-11-10T08:00:00Z" }] }),
      now: NOW,
    });
    expect(result).toEqual({ registered: "2026-11-10T08:00:00.000Z", ageDays: 4, lookup: "found" });
  });

  it("reports domains the registry has never heard of", async () => {
    const result = await lookupDomainAge("never-registered-2.top", { fetchImpl: fakeFetch(404, {}), now: NOW });
    expect(result.lookup).toBe("not_found");
  });

  it("asks the registry IANA lists for the domain's ending, with a User-Agent", async () => {
    const calls: Array<{ url: string; ua: string | null }> = [];
    const routed = (async (url: string, init?: RequestInit) => {
      calls.push({ url, ua: new Headers(init?.headers).get("user-agent") });
      if (url.includes("data.iana.org")) {
        return Response.json({ services: [[["top"], ["https://rdap.example-registry.top/"]]] });
      }
      return Response.json({ events: [{ eventAction: "registration", eventDate: "2026-11-01T00:00:00Z" }] });
    }) as typeof fetch;

    const result = await lookupDomainAge("routed-4.top", { fetchImpl: routed, now: NOW });
    expect(result.ageDays).toBe(13);
    expect(calls.map((c) => c.url)).toEqual(["https://data.iana.org/rdap/dns.json", "https://rdap.example-registry.top/domain/routed-4.top"]);
    expect(calls.every((c) => c.ua?.startsWith("ScamCheck"))).toBe(true);
  });

  it("degrades to unavailable when the registry fails", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const result = await lookupDomainAge("anything-3.top", { fetchImpl: failing, now: NOW });
    expect(result).toEqual({ registered: null, ageDays: null, lookup: "unavailable" });
  });
});
