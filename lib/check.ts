import { analyzeMessage, type AnalyzeInput } from "./analyze";
import { defang, extractLinks, linkPatternFlags } from "./links";
import { reportLinks } from "./rdap";
import type { AiVerdict, CheckResult, LinkReport, RedFlag, Verdict } from "./schema";

export interface CheckDeps {
  analyze: (input: AnalyzeInput) => Promise<AiVerdict>;
  reportLinks: typeof reportLinks;
  now: () => Date;
}

const defaultDeps: CheckDeps = { analyze: analyzeMessage, reportLinks, now: () => new Date() };

function ageText(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** Combines the AI's reading with facts we measured ourselves. Measured facts can raise the verdict, never lower it. */
export function mergeResult(ai: AiVerdict, links: LinkReport[], now: Date): CheckResult {
  const flags: RedFlag[] = ai.red_flags.slice(0, 5).map((flag) => ({ ...flag, source: "ai" }));
  let strongSignals = 0;

  for (const link of links) {
    if (link.lookup === "found" && link.ageDays !== null && link.ageDays < 90) {
      flags.push({
        quote: link.url,
        reason: `${link.domain} was registered ${ageText(link.ageDays)}. Real companies' websites are usually years old.`,
        source: "domain_registry",
      });
      if (link.ageDays < 30) strongSignals++;
    } else if (link.lookup === "not_found") {
      flags.push({
        quote: link.url,
        reason: `The domain registry has no record of ${link.domain}. The site may be fake or already taken down.`,
        source: "domain_registry",
      });
    }
    for (const flag of linkPatternFlags(link)) {
      flags.push({ quote: link.url, reason: flag.reason, source: "link_check" });
      if (flag.strong) strongSignals++;
    }
  }

  let verdict: Verdict = ai.verdict;
  if (strongSignals > 0 && verdict === "no_red_flags") verdict = "suspicious";

  // Every link we show is defanged (hxxps://site[.]top) so no warning can send someone to the scam.
  return {
    verdict,
    headline: ai.headline,
    scamType: ai.scam_type,
    message: defang(ai.message_text),
    flags: flags.map((flag) => ({ ...flag, quote: defang(flag.quote), reason: defang(flag.reason) })),
    advice: ai.advice.slice(0, 4),
    links: links.map((link) => ({ ...link, url: defang(link.url) })),
    language: ai.language,
    checkedAt: now.toISOString(),
  };
}

/** Runs the AI reading and the domain lookups (in parallel when the links are already visible in the text). */
export async function runCheck(input: AnalyzeInput, deps: CheckDeps = defaultDeps): Promise<CheckResult> {
  const textLinks = input.text ? extractLinks(input.text) : [];
  const [ai, textReports] = await Promise.all([deps.analyze(input), deps.reportLinks(textLinks)]);

  // Links inside a screenshot are only known once the AI has transcribed it.
  const known = new Set(textLinks.map((link) => link.hostname));
  const transcribedLinks = extractLinks(ai.message_text).filter((link) => !known.has(link.hostname));
  const transcribedReports = transcribedLinks.length ? await deps.reportLinks(transcribedLinks) : [];

  return mergeResult(ai, [...textReports, ...transcribedReports].slice(0, 5), deps.now());
}
