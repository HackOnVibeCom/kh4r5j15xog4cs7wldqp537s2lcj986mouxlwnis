// npx tsx src/build.ts
// Turns the voice and the recording into the edit: when each line plays, which stretch of the
// recording plays under it (sped up or slowed to fit), plus the real preview card and the real
// Telegram reply text for the graphics. Writes .out/props.json for the Remotion render.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { formatVerdict } from "../../lib/telegram";
import type { CheckResult } from "../../lib/schema";
import { BOT, OUT, SITE } from "./paths";
import type { RecEvent } from "./record";
import { LINES } from "./script";
import type { VoicedLine } from "./voice";
import type { VideoProps, SceneProps } from "../remotion/types";

const FPS = 30;
const GAP = 0.35; // silence between lines
const MAX_SPEED = 2.4; // faster than this and typing looks frantic

const voice: VoicedLine[] = JSON.parse(await readFile(path.join(OUT, "voice.json"), "utf8"));
const rec = JSON.parse(await readFile(path.join(OUT, "rec", "recording.json"), "utf8")) as {
  viewport: { width: number; height: number };
  scale: number;
  warningUrl: string;
  frames: { t: number; file: string }[];
  events: RecEvent[];
};
const marks = new Map(rec.events.filter((e): e is Extract<RecEvent, { kind: "mark" }> => e.kind === "mark").map((e) => [e.name, e.t]));
const mark = (name: string) => {
  const t = marks.get(name);
  if (t === undefined) throw new Error(`no mark "${name}" in the recording`);
  return t;
};

let at = 0.6;
const lines: VideoProps["lines"] = [];
const scenes: SceneProps[] = [];

for (const line of LINES) {
  const voiced = voice.find((v) => v.key === line.key);
  if (!voiced) throw new Error(`no voice for ${line.key}; run voice.ts`);
  let length = voiced.duration + 0.5;
  let part: SceneProps["part"];
  if (line.scene.kind === "rec") {
    const recStart = mark(line.scene.from);
    const recEnd = mark(line.scene.to);
    length = Math.max(length, (recEnd - recStart) / MAX_SPEED);
    part = { recStart, recEnd };
  }
  if (line.scene.kind === "intro" || line.scene.kind === "card") length = Math.max(length, 3);
  scenes.push({ key: line.key, kind: line.scene.kind, graphic: "graphic" in line.scene ? line.scene.graphic : undefined, label: line.label, start: at, end: at + length, part });
  lines.push({ key: line.key, text: line.text, file: voiced.file, at: at + 0.15, duration: voiced.duration, words: voiced.words });
  at += length + GAP;
}
const end = at + 0.8;

// The real warning card WhatsApp and Telegram show for the parcel check's link.
const ogRes = await fetch(`${rec.warningUrl}/opengraph-image`);
if (!ogRes.ok) throw new Error(`preview image: ${ogRes.status}`);
await writeFile(path.join(OUT, "preview.png"), Buffer.from(await ogRes.arrayBuffer()));

// The bot's reply for the same check, from the same formatter the bot uses.
const token = rec.warningUrl.split("/v/")[1]!;
const result = JSON.parse(inflateRawSync(Buffer.from(token.split("~")[0]!, "base64url")).toString("utf8")) as CheckResult;
const telegramText = formatVerdict(result, rec.warningUrl);
const parcelMessage = result.message;

const props: VideoProps = {
  base: "",
  fps: FPS,
  durationInFrames: Math.ceil(end * FPS),
  lines,
  scenes,
  rec: { viewport: rec.viewport, scale: rec.scale, frames: rec.frames, events: rec.events },
  preview: "preview.png",
  previewUrl: rec.warningUrl,
  telegramText,
  parcelMessage,
  site: SITE.replace(/^https?:\/\//, ""),
  bot: BOT,
};
await writeFile(path.join(OUT, "props.json"), JSON.stringify(props, null, 1));
for (const s of scenes) console.log(`${s.start.toFixed(1).padStart(6)}–${s.end.toFixed(1).padEnd(6)} ${s.kind.padEnd(5)} ${s.key}${s.part ? `  rec ${(s.part.recEnd - s.part.recStart).toFixed(1)} s → ${((s.part.recEnd - s.part.recStart) / (s.end - s.start)).toFixed(2)}x` : ""}`);
console.log(`total ${end.toFixed(1)} s`);
