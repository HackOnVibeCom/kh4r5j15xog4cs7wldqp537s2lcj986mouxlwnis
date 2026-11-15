// npx tsx src/render.ts                 the full video: .out/scamcheck-demo.mp4
// npx tsx src/render.ts --stills 5,30   frames at those seconds, for review: .out/stills/
// Serves .out over a local port so the composition can load the frames, voice and preview card,
// and renders with Playwright's headless Chrome (already installed for the recorder).

import { createReadStream, existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { VideoProps } from "../remotion/types";
import { OUT, VIDEO } from "./paths";

const { values } = parseArgs({ options: { stills: { type: "string" } } });

function headlessShell(): string | undefined {
  const root = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "ms-playwright");
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().at(-1);
  if (!dir) return undefined;
  const exe = path.join(root, dir, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
  return existsSync(exe) ? exe : undefined;
}

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".wav": "audio/wav", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  const file = path.join(OUT, decodeURIComponent((req.url ?? "/").split("?")[0]!));
  if (!file.startsWith(OUT) || !existsSync(file) || !(await stat(file)).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "access-control-allow-origin": "*" });
  createReadStream(file).pipe(res);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const inputProps: VideoProps = { ...JSON.parse(await readFile(path.join(OUT, "props.json"), "utf8")), base };
const browserExecutable = headlessShell();
const browser = await openBrowser("chrome", { browserExecutable });
const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "remotion", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "ScamCheckDemo", inputProps, browserExecutable, puppeteerInstance: browser });

try {
  if (values.stills) {
    await mkdir(path.join(OUT, "stills"), { recursive: true });
    for (const second of values.stills.split(",").map(Number)) {
      const output = path.join(OUT, "stills", `t${String(second).padStart(5, "0")}.jpg`);
      await renderStill({ composition, serveUrl, output, frame: Math.min(composition.durationInFrames - 1, Math.round(second * composition.fps)), inputProps, imageFormat: "jpeg", jpegQuality: 85, browserExecutable, puppeteerInstance: browser });
      console.log(output);
    }
  } else {
    const output = path.join(OUT, "scamcheck-demo.mp4");
    let lastShown = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 18,
      audioCodec: "aac",
      outputLocation: output,
      inputProps,
      browserExecutable,
      puppeteerInstance: browser,
      concurrency: Math.max(2, Math.min(8, os.cpus().length - 1)),
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== lastShown) {
          lastShown = pct;
          console.log(`render ${pct}%`);
        }
      },
    });
    console.log(output);
  }
} finally {
  await browser.close({ silent: true });
  server.close();
}
