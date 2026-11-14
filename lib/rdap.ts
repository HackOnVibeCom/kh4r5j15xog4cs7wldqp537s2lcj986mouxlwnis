import type { LinkReport } from "./schema";
import type { FoundLink } from "./links";

type Fetch = typeof fetch;

export interface DomainAge {
  registered: string | null;
  ageDays: number | null;
  lookup: LinkReport["lookup"];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: DomainAge; expires: number }>();

/** Reads the registration date out of an RDAP domain response. */
export function parseRegistration(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return null;
  for (const event of events) {
    if (
      event &&
      typeof event === "object" &&
      (event as { eventAction?: unknown }).eventAction === "registration" &&
      typeof (event as { eventDate?: unknown }).eventDate === "string"
    ) {
      const date = new Date((event as { eventDate: string }).eventDate);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return null;
}

/**
 * Asks the public domain registry (RDAP, via rdap.org) when a domain was registered.
 * Scam sites are usually days or weeks old; real companies' sites are years old.
 */
export async function lookupDomainAge(
  domain: string,
  { fetchImpl = fetch, timeoutMs = 4000, now = Date.now() }: { fetchImpl?: Fetch; timeoutMs?: number; now?: number } = {},
): Promise<DomainAge> {
  const cached = cache.get(domain);
  if (cached && cached.expires > now) return cached.value;

  let value: DomainAge;
  try {
    const res = await fetchImpl(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 404) {
      value = { registered: null, ageDays: null, lookup: "not_found" };
    } else if (!res.ok) {
      value = { registered: null, ageDays: null, lookup: "unavailable" };
    } else {
      const registered = parseRegistration(await res.json());
      value = registered
        ? { registered, ageDays: Math.max(0, Math.floor((now - Date.parse(registered)) / DAY_MS)), lookup: "found" }
        : { registered: null, ageDays: null, lookup: "unavailable" };
    }
  } catch {
    value = { registered: null, ageDays: null, lookup: "unavailable" };
  }

  if (value.lookup !== "unavailable") cache.set(domain, { value, expires: now + 6 * 60 * 60 * 1000 });
  return value;
}

export async function reportLinks(links: FoundLink[], options?: Parameters<typeof lookupDomainAge>[1]): Promise<LinkReport[]> {
  return Promise.all(
    links.map(async (link) => ({ ...link, ...(await lookupDomainAge(link.domain, options)) })),
  );
}
