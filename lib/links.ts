import { parse } from "tldts";

export interface FoundLink {
  url: string;
  hostname: string;
  domain: string;
}

// Full URLs, or bare hostnames such as "sbi-kyc.top/verify". Emails are skipped below.
const LINK_PATTERN =
  /\b(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})(?::\d{2,5})?(?:\/[^\s<>"')\]]*)?/gi;

/** Finds links in free text and keeps only ones with a real public suffix. */
export function extractLinks(text: string, limit = 5): FoundLink[] {
  const seen = new Map<string, FoundLink>();
  for (const match of text.matchAll(LINK_PATTERN)) {
    const raw = match[0].replace(/[.,;:!?]+$/, "");
    const start = match.index ?? 0;
    if (start > 0 && text[start - 1] === "@") continue; // part of an email address

    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    let hostname: string;
    try {
      hostname = new URL(withScheme).hostname.toLowerCase();
    } catch {
      continue;
    }
    const info = parse(hostname);
    if (!info.domain || !info.isIcann) continue;
    if (!seen.has(hostname)) seen.set(hostname, { url: raw, hostname, domain: info.domain });
  }
  return [...seen.values()].slice(0, limit);
}

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
  "rebrand.ly", "shorturl.at", "rb.gy", "tiny.cc", "s.id", "t.ly", "v.gd", "lnkd.in",
]);

/** Brands scammers impersonate most, with the domains they really use. */
const BRANDS: Array<{ name: string; tokens: string[]; domains: string[] }> = [
  { name: "PayPal", tokens: ["paypal"], domains: ["paypal.com", "paypal.me"] },
  { name: "Amazon", tokens: ["amazon"], domains: ["amazon.com", "amazon.in", "amazon.co.uk", "amazon.de", "amazon.ca"] },
  { name: "Apple", tokens: ["apple", "icloud"], domains: ["apple.com", "icloud.com"] },
  { name: "Microsoft", tokens: ["microsoft", "outlook", "office365"], domains: ["microsoft.com", "live.com", "outlook.com", "office.com"] },
  { name: "Netflix", tokens: ["netflix"], domains: ["netflix.com"] },
  { name: "Google", tokens: ["google", "gmail"], domains: ["google.com", "gmail.com"] },
  { name: "Facebook", tokens: ["facebook", "meta"], domains: ["facebook.com", "meta.com", "fb.com"] },
  { name: "Instagram", tokens: ["instagram"], domains: ["instagram.com"] },
  { name: "WhatsApp", tokens: ["whatsapp"], domains: ["whatsapp.com", "wa.me"] },
  { name: "DHL", tokens: ["dhl"], domains: ["dhl.com", "dhl.de"] },
  { name: "FedEx", tokens: ["fedex"], domains: ["fedex.com"] },
  { name: "UPS", tokens: ["ups"], domains: ["ups.com"] },
  { name: "USPS", tokens: ["usps"], domains: ["usps.com"] },
  { name: "Royal Mail", tokens: ["royalmail"], domains: ["royalmail.com"] },
  { name: "India Post", tokens: ["indiapost"], domains: ["indiapost.gov.in"] },
  { name: "SBI", tokens: ["sbi", "onlinesbi"], domains: ["onlinesbi.sbi", "sbi.co.in", "sbi.bank.in"] },
  { name: "HDFC Bank", tokens: ["hdfc"], domains: ["hdfcbank.com", "hdfc.bank.in"] },
  { name: "ICICI Bank", tokens: ["icici"], domains: ["icicibank.com", "icici.bank.in"] },
  { name: "Paytm", tokens: ["paytm"], domains: ["paytm.com"] },
  { name: "IRS", tokens: ["irs"], domains: ["irs.gov"] },
];

export interface LinkFlag {
  reason: string;
  /** Strong flags are enough on their own to call a message suspicious. */
  strong: boolean;
}

/** Deterministic link warnings. Each one is a fact about the link, not an AI opinion. */
export function linkPatternFlags(link: Pick<FoundLink, "hostname" | "domain">): LinkFlag[] {
  const flags: LinkFlag[] = [];
  const { hostname, domain } = link;

  if (SHORTENERS.has(domain)) {
    flags.push({ reason: `The link uses a URL shortener (${domain}), which hides where it really goes.`, strong: false });
  }
  if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
    flags.push({ reason: `The address ${hostname} uses look-alike characters from another alphabet.`, strong: true });
  }

  const words = hostname.split(/[.-]/);
  for (const brand of BRANDS) {
    const mentionsBrand = brand.tokens.some((token) => words.includes(token));
    if (mentionsBrand && !brand.domains.includes(domain)) {
      flags.push({ reason: `The link uses the name ${brand.name}, but ${domain} is not a ${brand.name} website.`, strong: true });
      break;
    }
  }
  return flags;
}

/** Makes links unclickable for display in shared warnings: hxxps://example[.]com */
export function defang(text: string): string {
  let out = text.replace(/\bhttp(s?):\/\//gi, "hxxp$1://");
  for (const link of extractLinks(text, Infinity)) {
    const escaped = link.hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), (m) => m.replace(/\./g, "[.]"));
  }
  return out;
}
