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

  it("degrades to unavailable when the registry fails", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const result = await lookupDomainAge("anything-3.top", { fetchImpl: failing, now: NOW });
    expect(result).toEqual({ registered: null, ageDays: null, lookup: "unavailable" });
  });
});
