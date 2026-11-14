import type { FlagSource, Verdict } from "./schema";

export const APP_NAME = "ScamCheck";

export const VERDICT_COPY: Record<Verdict, { label: string; short: string; tone: "danger" | "warn" | "calm" }> = {
  likely_scam: { label: "Likely scam", short: "Likely scam", tone: "danger" },
  suspicious: { label: "Suspicious: check before you act", short: "Suspicious", tone: "warn" },
  no_red_flags: { label: "No red flags found", short: "No red flags found", tone: "calm" },
};

export const SOURCE_COPY: Record<FlagSource, string> = {
  ai: "AI reading",
  domain_registry: "Checked: domain registry",
  link_check: "Checked: link address",
};

/** Real-world scam formats, used as one-click examples. The check that runs on them is real. */
export const EXAMPLES: Array<{ label: string; text: string }> = [
  {
    label: "Power cut tonight",
    text: "Dear Consumer, your electricity power will be disconnected tonight at 9:30 PM because your previous month bill was not updated. Please contact our electricity officer immediately on 90000 00000. Thank you.",
  },
  {
    label: "Parcel on hold",
    text: "USPS: Your package is on hold due to an incomplete address. Update your details within 12 hours or it will be returned to sender: https://usps-parcel-hold.top/track",
  },
  {
    label: "Easy job offer",
    text: "Hi, I'm Priya from a recruitment agency 😊 We have a part-time job: like YouTube videos from home and earn ₹3,000–₹8,000 per day. No experience needed. Interested? Reply YES and our HR will add you on Telegram.",
  },
  {
    label: "“Hi Mum, new number”",
    text: "Hi Mum, I dropped my phone in the toilet 😩 this is my new number. Can you do me a favour? I need to pay a bill urgently today and my banking app isn't working on this phone.",
  },
];
