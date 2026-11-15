import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The video folder and its gitignored output: voice, recording, props and the render. */
export const VIDEO = path.resolve(here, "..");
export const OUT = path.join(VIDEO, ".out");
export const SITE = process.env.VIDEO_SITE ?? "https://scam-check-seven.vercel.app";
export const BOT = "ScamCheck2026Bot";
