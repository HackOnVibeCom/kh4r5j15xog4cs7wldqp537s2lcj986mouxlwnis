import type { AiVerdict, CheckResult } from "@/lib/schema";

export const scamVerdict: AiVerdict = {
  verdict: "likely_scam",
  headline: "Fake electricity disconnection notice",
  scam_type: "Utility bill scam",
  message_text:
    "Dear Consumer, your electricity will be disconnected tonight at 9:30 PM. Update your bill at bses-bill-update.top or call 90000 00000.",
  red_flags: [
    { quote: "disconnected tonight at 9:30 PM", reason: "Real power companies give written notice, not a same-night threat." },
    { quote: "call 90000 00000", reason: "Power companies don't ask you to call a personal mobile number." },
  ],
  advice: ["Don't call the number.", "Check your bill on your power company's official app or website."],
  language: "en",
};

export const cleanVerdict: AiVerdict = {
  verdict: "no_red_flags",
  headline: "Ordinary delivery update",
  scam_type: "None found",
  message_text: "Your order has shipped. Track it at www.amazon.in/orders.",
  red_flags: [],
  advice: ["If in doubt, open the shop's app yourself instead of using links."],
  language: "en",
};

export const sampleResult: CheckResult = {
  verdict: "likely_scam",
  headline: scamVerdict.headline,
  scamType: scamVerdict.scam_type,
  message: scamVerdict.message_text,
  flags: scamVerdict.red_flags.map((flag) => ({ ...flag, source: "ai" as const })),
  advice: scamVerdict.advice,
  links: [],
  language: "en",
  checkedAt: "2026-11-14T12:00:00.000Z",
};
