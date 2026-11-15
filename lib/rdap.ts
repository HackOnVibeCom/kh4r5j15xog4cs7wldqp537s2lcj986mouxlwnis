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
// Some registries and rdap.org reject requests that don't identify themselves.
const HEADERS = { accept: "application/rdap+json, application/json", "user-agent": "ScamCheck/0.1 (domain age check)" };

let bootstrap: { servers: Map<string, string>; expires: number } | null = null;

/** IANA's official list of which RDAP server answers for each top-level domain. */
async function registryBase(tld: string, fetchImpl: Fetch, now: number): Promise<string> {
  if (!bootstrap || bootstrap.expires < now) {
    try {
      const res = await fetchImpl("https://data.iana.org/rdap/dns.json", { headers: HEADERS, signal: AbortSignal.timeout(3000) });
      const body = (await res.json()) as { services?: unknown };
      const servers = new Map<string, string>();
      if (Array.isArray(body.services)) {
        for (const [tlds, urls] of body.services as Array<[string[], string[]]>) {
          const url = urls.find((u) => u.startsWith("https://")) ?? urls[0];
          for (const t of tlds) if (url) servers.set(t.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
        }
      }
      if (servers.size > 0) bootstrap = { servers, expires: now + DAY_MS };
    } catch {
      // Fall through to the public redirector below.
    }
  }
  return bootstrap?.servers.get(tld) ?? "https://rdap.org/";
}

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
 * Asks the domain's own registry (RDAP) when it was registered.
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
    const base = await registryBase(domain.split(".").pop() ?? "", fetchImpl, now);
    const res = await fetchImpl(`${base}domain/${encodeURIComponent(domain)}`, {
      headers: HEADERS,
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
