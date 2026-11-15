// npx tsx src/voice.ts [key ...]
// Voices each line with Deepgram Aura-2, then transcribes it back with nova-3 so the captions get
// word timings. Reads DEEPGRAM_KEY from the environment or from DEEPGRAM_ENV_FILE (a .env file);
// the key is never printed. Output: .out/voice/<key>.wav and .out/voice.json.

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { OUT } from "./paths";
import { LINES, VOICE } from "./script";

export interface Word {
  text: string;
  start: number;
  end: number;
}
export interface VoicedLine {
  key: string;
  text: string;
  file: string;
  duration: number;
  words: Word[];
}

function deepgramKey(): string {
  if (process.env.DEEPGRAM_KEY) return process.env.DEEPGRAM_KEY;
  const file = process.env.DEEPGRAM_ENV_FILE;
  if (file && existsSync(file)) {
    const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /^\s*DEEPGRAM_KEY\s*=/.test(l));
    const value = line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  throw new Error("Set DEEPGRAM_KEY, or DEEPGRAM_ENV_FILE pointing at a .env file that has it.");
}

/** Seconds of audio in a 16-bit PCM WAV, read from its fmt and data chunks. */
export function wavDuration(wav: Buffer): number {
  let offset = 12;
  let rate = 48000;
  let channels = 1;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = wav.readUInt16LE(offset + 10);
      rate = wav.readUInt32LE(offset + 12);
    }
    if (id === "data") return Math.min(size, wav.length - offset - 8) / (rate * channels * 2);
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk in WAV");
}

async function speak(text: string, key: string): Promise<Buffer> {
  const params = new URLSearchParams({ model: VOICE, encoding: "linear16", container: "wav", sample_rate: "48000" });
  const res = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Deepgram speak failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function transcribe(wav: Buffer, key: string): Promise<Array<{ word: string; punctuated_word?: string; start: number; end: number }>> {
  const params = new URLSearchParams({ model: "nova-3", punctuate: "true", smart_format: "false" });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
    body: new Uint8Array(wav),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: { channels?: { alternatives?: { words?: Array<{ word: string; start: number; end: number }> }[] }[] } };
  return data.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
}

/** Script words with times: transcript times when the word counts line up, otherwise spread by length. */
function alignWords(text: string, heard: Array<{ start: number; end: number }>, duration: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (heard.length === tokens.length) return tokens.map((t, i) => ({ text: t, start: heard[i]!.start, end: heard[i]!.end }));
  const start = heard[0]?.start ?? 0.05;
  const end = heard.at(-1)?.end ?? duration - 0.05;
  const total = tokens.reduce((n, t) => n + t.length + 1, 0);
  let at = start;
  return tokens.map((t) => {
    const span = ((t.length + 1) / total) * (end - start);
    const word = { text: t, start: at, end: at + span };
    at += span;
    return word;
  });
}

const key = deepgramKey();
const only = new Set(process.argv.slice(2));
const voiceFile = path.join(OUT, "voice.json");
const previous: VoicedLine[] = only.size && existsSync(voiceFile) ? JSON.parse(await readFile(voiceFile, "utf8")) : [];
await mkdir(path.join(OUT, "voice"), { recursive: true });

const result: VoicedLine[] = [];
for (const line of LINES) {
  const old = previous.find((p) => p.key === line.key && p.text === line.text);
  if (only.size && !only.has(line.key) && old) {
    result.push(old);
    continue;
  }
  const wav = await speak(line.text, key);
  const duration = wavDuration(wav);
  if (duration < 0.4) throw new Error(`${line.key}: Deepgram returned almost nothing; reword it`);
  const file = `voice/${line.key}.wav`;
  await writeFile(path.join(OUT, file), wav);
  const words = alignWords(line.text, await transcribe(wav, key), duration);
  result.push({ key: line.key, text: line.text, file, duration, words });
  console.log(`${line.key.padEnd(9)} ${duration.toFixed(2)} s  ${line.text}`);
}
await writeFile(voiceFile, JSON.stringify(result, null, 2));
console.log(`total narration: ${result.reduce((s, l) => s + l.duration, 0).toFixed(1)} s`);
