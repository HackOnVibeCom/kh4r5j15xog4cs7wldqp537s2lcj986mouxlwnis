# ScamCheck

**Paste a message that feels off. Know in seconds if it's a scam, and why. Then warn your family in one tap.**

**Try it: [scam-check-seven.vercel.app](https://scam-check-seven.vercel.app)** (free, no sign-up; tap an example to see a check in about 3 seconds)

Built for HackOnVibe November 2026 ("Zero-CAC IT product").

## The problem

In 2024, Americans reported losing $12.5 billion to fraud, 25% more than the year before ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024)). Worldwide, a 58,000-person survey estimated $1.03 trillion lost in a year, with only 4% of victims getting their money back ([Global Anti-Scam Alliance, 2024](https://www.gasa.org/post/global-state-of-scams-report-2024-1-trillion-stolen-in-12-months-gasa-feedzai)).

Scams arrive by text and WhatsApp, and they spread through family chats. Today the only check most people have is forwarding the message to a son or daughter and asking "is this real?"

## What it does

1. **Paste the message or add a screenshot.** No account, works on any phone.
2. **Get a straight answer:** "Likely scam", "Suspicious" or "No red flags found", with each warning sign highlighted in the message and explained in plain words, in the message's own language. Every link is looked up in the public domain registry, which shows how old the site is or that it doesn't exist at all. Those are facts, not guesses, and they're labeled that way.
3. **Send the warning on.** One tap creates a warning link for WhatsApp. Your own name, account and card numbers and codes are hidden, and links in it can't be clicked. Whoever opens it can pass it on, or check their own message.

## Why it spreads by itself

Scams travel through family and group chats, so the warning travels the same way. Every warning page ends with "Got a message like this? Check it free." And anyone can send a parent a link that opens with "Priya set this up for you", so the checker arrives from someone they trust. This is the design; there are no usage numbers yet.

## What's real

- Every check is a live AI reading of the message you give it, including the four one-click examples.
- Domain ages come live from the public domain registry (RDAP). Look-alike brand domains and hidden-destination links are checked by code.
- Each reason is labeled "AI reading" or "Checked", so nobody mistakes an AI opinion for a measured fact.
- It never says "safe". The best answer is "No red flags found", with a reminder to verify anything that asks for money or codes.
- Nothing is stored. A warning link carries the cleaned-up verdict inside the link itself, signed so nobody can forge a fake "no red flags" card.

## Business model (planned, not built)

Free for people, forever. Revenue would come from organizations that need the same check at scale: banks, phone carriers and messaging apps paying per check through an API, or embedding the warning card in their own apps.

## Try it

- Live app: https://scam-check-seven.vercel.app
- Code: this repository

---

## How it works

```
Browser ──POST /api/check──▶ Next.js route (Node)
                              ├─ AI reads text or screenshot and returns a structured verdict
                              │  (one Zod schema; Google Gemini or Anthropic Claude, set by env)
                              ├─ RDAP lookups for every link, sent to the domain's own registry
                              │  (from IANA's list; in parallel with the AI for pasted text)
                              ├─ code checks: look-alike brands, punycode, URL shorteners
                              └─ merge: measured facts can raise the verdict, never lower it
                           ◀── verdict + signed share token (deflate + HMAC, nothing stored)

/v/<token>                  warning page and WhatsApp preview image, rendered from the token
```

| Path | What it does |
|---|---|
| `lib/ai-shared.ts` | The prompt, input type and error kinds shared by both AI providers. |
| `lib/gemini.ts` | Gemini call with JSON-schema output. Starts with 3.5 Flash-Lite (about 2 s), retries once when Google is overloaded, falls back to 3.5 Flash, and skips a model for 5 minutes after quota errors or timeouts. |
| `lib/claude.ts` | Claude call with structured output and refusal fallback. |
| `lib/analyze.ts` | Picks the provider from the server's keys. |
| `lib/links.ts` | Finds links in text, brand and look-alike checks, defanging (`hxxps://site[.]top`). |
| `lib/rdap.ts` | Domain registration date from the public registry, cached, with a 4-second timeout. |
| `lib/check.ts` | Runs the AI and the lookups, merges them into one result. |
| `lib/token.ts` | Signs and verifies warning-link tokens. |
| `app/api/check/route.ts` | Input validation, rate limiting, friendly errors. |
| `app/v/[token]/` | Warning page and its Open Graph image. |

## Run it locally

```bash
npm install
cp .env.example .env.local   # then add one AI key to .env.local (never to .env.example)
npm run dev                  # http://localhost:3000
npm test                     # 41 tests: links, registry lookups, tokens, merging, both AI paths, API route
```

Set one AI key: `GEMINI_API_KEY` (free from Google AI Studio) or `ANTHROPIC_API_KEY`. If both are set, Claude is used unless `AI_PROVIDER=gemini`. `GEMINI_MODEL` puts another Gemini model in front of the defaults, for example `gemini-4-hydrogen`. `SHARE_SECRET` is optional; without it, the warning-link signing key is derived from the AI key on the server.
