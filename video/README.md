# The demo video

ScamCheck's submission video, built in code: a narrated walkthrough of the live app at phone size, with motion graphics around it. The approach (DevTools screencast with logged taps, Deepgram narration with word timings, Remotion for the edit) follows the demo pipeline from Premiere.

- **Narration:** Deepgram Aura-2 (Thalia). Each line is transcribed back with nova-3 for word-timed captions.
- **Footage:** a Playwright recording of the live site, with three real checks against the live AI.
- **Graphics:** the preview card is the real image the site generates for the recorded check, and the Telegram card shows the bot's real reply format for that same check.

## Rebuild it

```bash
cd video && npm install
DEEPGRAM_ENV_FILE=/path/to/.env npx tsx src/voice.ts   # or DEEPGRAM_KEY=... ; the key is never printed
npx tsx src/record.ts                                   # drives https://scam-check-seven.vercel.app (VIDEO_SITE to change)
npx tsx src/build.ts                                    # the edit: .out/props.json
npx tsx src/render.ts --stills 5,40                     # review frames
npx tsx src/render.ts                                   # .out/scamcheck-demo.mp4
```

Output goes to `video/.out` (gitignored). The video is kept out of the website build (`tsconfig.json` and `.vercelignore`).
