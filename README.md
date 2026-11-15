# ScamCheck

**Paste a message that feels off. Know in seconds if it's a scam, and why. Then warn your family in one tap.**

Free, no sign-up. Built for HackOnVibe November 2026 ("Zero-CAC IT product").

## The problem

People lost $1.03 trillion to scams in a year, and only 4% of victims got their money back ([Global Anti-Scam Alliance, 2024](https://www.gasa.org/post/global-state-of-scams-report-2024-1-trillion-stolen-in-12-months-gasa-feedzai)). In the US alone, reported fraud losses reached $12.5 billion in 2024 ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024)).

Scams arrive by text and WhatsApp, and they spread through family chats. Today the only check most people have is forwarding the message to a son or daughter and asking "is this real?"

## What it does

1. **Paste the message or add a screenshot.** No account, works on any phone.
2. **Get a straight answer:** "Likely scam", "Suspicious" or "No red flags found", with each warning sign highlighted in the message and explained in plain words. Links are checked against the public domain registry: a "bank" website registered three days ago is a fact, not a guess.
3. **Send the warning on.** One tap creates a warning link for WhatsApp. Personal details are hidden and links in it can't be clicked. Whoever opens it can pass it on, or check their own message.

## Why it spreads by itself

Scams travel through family and group chats, so the warning travels the same way. Every warning page ends with "Got a message like this? Check it free." And anyone can send a parent a link that opens with "Priya set this up for you": the person most likely to be targeted gets the checker from someone they trust.

## What's real

- Every check is a live AI reading of the message you give it, including the four one-click examples.
- Domain ages come live from the public domain registry (RDAP). Look-alike brand domains and hidden-destination links are checked by code.
- Each reason is labeled "AI reading" or "Checked", so nobody mistakes an AI opinion for a measured fact.
- It never says "safe". The best answer is "No red flags found", with a reminder to verify anything that asks for money or codes.
- Nothing is stored. A warning link carries the cleaned-up verdict inside the link itself, signed so nobody can forge a fake "no red flags" card.

## Business model (planned, not built)

Free for people, forever. Revenue would come from organizations that need the same check at scale: banks, phone carriers and messaging apps paying per check through an API, or embedding the warning card in their own apps.

## Try it

- Live app: _link added after the first deploy_
- Code: this repository

---

## How it works

```
Browser ──POST /api/check──▶ Next.js route (Node)
                              ├─ AI reads text or screenshot and returns a structured verdict
                              │  (one Zod schema; Google Gemini or Anthropic Claude, set by env)
                              ├─ RDAP lookups for every link (in parallel with the AI for pasted text)
                              ├─ code checks: look-alike brands, punycode, URL shorteners
                              └─ merge: measured facts can raise the verdict, never lower it
                           ◀── verdict + signed share token (deflate + HMAC, nothing stored)

/v/<token>                  warning page and WhatsApp preview image, rendered from the token
```

| Path | What it does |
|---|---|
| `lib/ai-shared.ts` | The prompt, input type and error kinds shared by both AI providers. |
| `lib/gemini.ts` | Gemini call with JSON-schema output; falls back to Flash-Lite when the free quota runs out. |
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
npm test                     # 37 tests: links, registry parsing, tokens, merging, both AI paths, API route
```

Set one AI key: `GEMINI_API_KEY` (free from Google AI Studio) or `ANTHROPIC_API_KEY`. If both are set, Claude is used unless `AI_PROVIDER=gemini`. `GEMINI_MODEL` overrides the default Gemini model. `SHARE_SECRET` is optional; without it, the warning-link signing key is derived from the AI key on the server.
