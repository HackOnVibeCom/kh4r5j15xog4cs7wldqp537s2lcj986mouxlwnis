// npx tsx src/record.ts
// Drives the live site at phone size through every beat of the narration and films it with the
// DevTools screencast (approach borrowed from Premiere's demo recorder). Headless Chrome draws no
// pointer, so every move and tap is logged and the edit draws the touch. Marks note where each
// beat starts. Three real checks run against the live AI.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Locator } from "playwright";
import { OUT, SITE } from "./paths";

export const VIEWPORT = { width: 430, height: 932 };
const SCALE = 2;

export type RecEvent =
  | { kind: "mark"; t: number; name: string }
  | { kind: "move"; t: number; until: number; x: number; y: number }
  | { kind: "click"; t: number; x: number; y: number };

const LEGIT =
  "Hi, this is a reminder of your dental appointment with Dr. Shah on Tuesday at 4:30 PM. Reply C to confirm or call the clinic to reschedule.";
const SPANISH =
  "Hola mamá, se me ha roto el móvil y este es mi número nuevo. ¿Me puedes hacer un Bizum de 480 € a este número? Es urgente, te lo devuelvo mañana.";

const dir = path.join(OUT, "rec");
const framesDir = path.join(dir, "frames");
await rm(dir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars"] });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: "light", isMobile: false, hasTouch: false });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: SITE });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

const frames: { t: number; file: string }[] = [];
let last = 0;
let writes = Promise.resolve();
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  const t = metadata.timestamp ?? Date.now() / 1000;
  if (t - last < 1 / 30) return;
  last = t;
  const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
  frames.push({ t, file });
  writes = writes.then(() => writeFile(path.join(framesDir, file), Buffer.from(data, "base64")));
});

const events: RecEvent[] = [];
const now = () => Date.now() / 1000;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const mark = (name: string) => {
  events.push({ kind: "mark", t: now(), name });
  console.log(`${new Date().toISOString().slice(11, 19)} ${name}`);
};
let pointer = { x: 300, y: 600 };
events.push({ kind: "move", t: now(), until: now(), ...pointer });

const SMOOTH_SCROLL = `(function (y, ms) {
  return new Promise(function (done) {
    var start = window.scrollY, delta = y - start, t0 = performance.now();
    function step(time) {
      var p = Math.min(1, (time - t0) / ms);
      var eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo(0, start + delta * eased);
      if (p < 1) requestAnimationFrame(step); else done();
    }
    requestAnimationFrame(step);
  });
})`;

async function scrollTo(y: number, seconds = 1.1) {
  await page.evaluate(`${SMOOTH_SCROLL}(${Math.round(y)}, ${Math.round(seconds * 1000)})`);
  await sleep(0.3);
}

async function scrollToTop(target: Locator, offset = 80, seconds = 1.1) {
  const top = await target.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await scrollTo(Math.max(0, top - offset), seconds);
}

async function moveTo(target: Locator, seconds = 0.6) {
  const seen = await target.boundingBox();
  if (seen && (seen.y < 40 || seen.y + seen.height > VIEWPORT.height - 40)) await scrollToTop(target, 260, 0.9);
  const b = await target.boundingBox();
  if (!b) throw new Error("nothing to move to");
  const to = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  const t = now();
  await page.mouse.move(to.x, to.y, { steps: Math.max(8, Math.round(seconds * 40)) });
  events.push({ kind: "move", t, until: Math.max(now(), t + seconds), ...to });
  if (now() < t + seconds) await sleep(t + seconds - now());
  pointer = to;
}

async function tap(target: Locator) {
  await moveTo(target);
  await sleep(0.15);
  events.push({ kind: "click", t: now(), ...pointer });
  await page.mouse.down();
  await sleep(0.06);
  await page.mouse.up();
}

let lastToken = "";
page.on("response", async (res) => {
  if (res.url().endsWith("/api/check") && res.ok()) {
    try {
      lastToken = ((await res.json()) as { token: string }).token;
    } catch {
      // ignore
    }
  }
});

/** Submits the form and waits for a verdict; retries once if the AI was busy. */
async function checkAndWait(submit: () => Promise<void>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await submit();
    const outcome = await Promise.race([
      page.locator(".verdict h2").waitFor({ timeout: 60_000 }).then(() => "ok"),
      page.locator(".error").waitFor({ timeout: 60_000 }).then(() => "error"),
    ]);
    if (outcome === "ok") return;
    console.warn("check failed, retrying:", await page.locator(".error").innerText());
    await sleep(3);
  }
  throw new Error("checks keep failing");
}

async function typeInto(target: Locator, text: string) {
  await tap(target);
  await page.keyboard.type(text, { delay: 14 });
}

async function home() {
  await page.goto(SITE, { waitUntil: "networkidle" });
  await sleep(0.8);
}

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: VIEWPORT.width * SCALE, maxHeight: VIEWPORT.height * SCALE, everyNthFrame: 1 });

// 1. Home, then the parcel example.
await home();
mark("home");
await sleep(2.5);
mark("example");
await checkAndWait(() => tap(page.getByRole("button", { name: "Parcel on hold" })));
await sleep(1.2);
mark("result");
await scrollToTop(page.locator(".verdict"), 70, 0.9);
await sleep(3);
mark("reasons");
await scrollToTop(page.locator(".flags"), 110, 1.2);
await sleep(4);
mark("advice");
await scrollToTop(page.locator(".advice"), 140, 1.0);
await sleep(2);
mark("share");
await scrollToTop(page.locator(".share"), 120, 1.0);
await sleep(0.8);
await tap(page.getByRole("button", { name: /Copy link/ }));
await sleep(1.6);
const warningUrl = `${SITE}/v/${lastToken}`;

// 2. The warning page a family member opens.
await page.goto(warningUrl, { waitUntil: "networkidle" });
await sleep(0.6);
mark("warning");
await sleep(2.2);
await scrollToTop(page.locator(".flags"), 110, 1.6);
await sleep(2);
await scrollToTop(page.locator(".cta"), 260, 1.6);
await sleep(2.2);
mark("warningEnd");

// 3. A legitimate message: no false alarm.
await home();
mark("legit");
await typeInto(page.locator("#message"), LEGIT);
await sleep(0.4);
await checkAndWait(() => tap(page.getByRole("button", { name: /Check message/ })));
await sleep(1.2);
await scrollToTop(page.locator(".verdict"), 70, 0.9);
await sleep(1.5);
await scrollToTop(page.locator(".caveat"), 300, 1.1);
await sleep(2);
mark("legitEnd");

// 4. A Spanish scam, answered in Spanish.
await home();
mark("spanish");
await typeInto(page.locator("#message"), SPANISH);
await sleep(0.4);
await checkAndWait(() => tap(page.getByRole("button", { name: /Check message/ })));
await sleep(1.2);
await scrollToTop(page.locator(".verdict"), 70, 0.9);
await sleep(1.6);
await scrollToTop(page.locator(".flags"), 110, 1.1);
await sleep(2.2);
mark("spanishEnd");

// 5. Setting it up for a parent.
await home();
mark("protect");
await scrollToTop(page.locator(".protect"), 140, 1.0);
await typeInto(page.locator("#from-name"), "Priya");
await sleep(1.4);
await page.goto(`${SITE}/?from=Priya`, { waitUntil: "networkidle" });
await sleep(3);
mark("protectEnd");

await cdp.send("Page.stopScreencast");
await sleep(0.5);
await writes;
await browser.close();

const t0 = frames[0]?.t ?? 0;
const rel = <T extends { t: number }>(e: T) => ({ ...e, t: e.t - t0, ...("until" in e ? { until: (e as { until: number }).until - t0 } : {}) });
await writeFile(
  path.join(dir, "recording.json"),
  JSON.stringify(
    {
      viewport: VIEWPORT,
      scale: SCALE,
      warningUrl,
      frames: frames.map((f) => ({ t: f.t - t0, file: f.file })),
      events: events.map(rel),
    },
    null,
    1,
  ),
);
console.log(`${frames.length} frames over ${(frames.at(-1)!.t - t0).toFixed(1)} s`);
