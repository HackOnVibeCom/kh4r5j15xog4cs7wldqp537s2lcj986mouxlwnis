import { z } from "zod";

/** Ordered from least to most alarming. We never return "safe". */
export const VERDICTS = ["no_red_flags", "suspicious", "likely_scam"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** What the AI must return. Kept flat and simple so structured outputs can enforce it. */
export const AiVerdictSchema = z.object({
  verdict: z
    .enum(VERDICTS)
    .describe(
      "likely_scam: clear signs of fraud. suspicious: some warning signs, needs care. no_red_flags: nothing found (never call a message safe).",
    ),
  headline: z
    .string()
    .describe("Under 8 words, naming the pattern, e.g. 'Fake electricity disconnection notice'."),
  scam_type: z
    .string()
    .describe("Short category, e.g. 'Utility bill scam', 'Delivery scam', 'Job scam', 'None found'."),
  message_text: z
    .string()
    .describe(
      "The message the person received, with the recipient's personal details replaced by placeholders. For screenshots, the transcribed message only.",
    ),
  red_flags: z
    .array(
      z.object({
        quote: z
          .string()
          .describe("Exact characters copied from message_text that show the problem. Empty string if the flag is about the whole message."),
        reason: z.string().describe("One plain sentence a grandparent would understand."),
      }),
    )
    .describe("Most important first. Empty if none."),
  advice: z.array(z.string()).describe("2 to 4 short, concrete steps. No phone numbers or websites."),
  language: z.string().describe("ISO 639-1 code of the message's language, e.g. 'en', 'hi', 'es'."),
});
export type AiVerdict = z.infer<typeof AiVerdictSchema>;

/** Where a red flag came from. Shown on screen so nobody mistakes an AI opinion for a measured fact. */
export type FlagSource = "ai" | "domain_registry" | "link_check";

export interface RedFlag {
  quote: string;
  reason: string;
  source: FlagSource;
}

export interface LinkReport {
  /** As written in the message. */
  url: string;
  hostname: string;
  /** Registrable domain, e.g. "example.co.uk". */
  domain: string;
  /** ISO date of registration from the domain registry, when found. */
  registered: string | null;
  ageDays: number | null;
  lookup: "found" | "not_found" | "unavailable";
}

export interface CheckResult {
  verdict: Verdict;
  headline: string;
  scamType: string;
  message: string;
  flags: RedFlag[];
  advice: string[];
  links: LinkReport[];
  language: string;
  checkedAt: string;
}
