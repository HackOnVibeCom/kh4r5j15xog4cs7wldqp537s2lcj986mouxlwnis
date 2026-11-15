import { createHash } from "node:crypto";
import { AnalysisError, IMAGE_TYPES, type AnalyzeInput, type ImageType } from "./ai-shared";
import { runCheck as defaultRunCheck } from "./check";
import { ERROR_COPY, SOURCE_COPY, VERDICT_COPY } from "./copy";
import { createRateLimiter } from "./ratelimit";
import type { CheckResult } from "./schema";
import { signShare as defaultSignShare } from "./token";

/** The parts of a Telegram update this bot reads. */
export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { language_code?: string };
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
  document?: { file_id: string; mime_type?: string; file_size?: number };
}
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface BotDeps {
  token: string;
  /** Site origin used for warning links, e.g. https://scam-check-seven.vercel.app */
  origin: string;
  fetchImpl?: typeof fetch;
  runCheck?: (input: AnalyzeInput) => Promise<CheckResult>;
  signShare?: (result: CheckResult) => string;
}

const MAX_IMAGE_BYTES = 4_000_000;
const allowChat = createRateLimiter({ limit: 12, windowMs: 10 * 60 * 1000 });

export function telegramToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || undefined;
}

/** Telegram echoes this in a header on every webhook call, so nobody else can post fake updates. */
export function webhookSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("hex");
}

export async function telegramCall<T = unknown>(
  token: string,
  method: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const VERDICT_EMOJI = { likely_scam: "⚠️", suspicious: "❓", no_red_flags: "✅" } as const;

/** The verdict as a Telegram message (HTML parse mode). The warning link's preview shows the warning card. */
export function formatVerdict(result: CheckResult, warningUrl: string): string {
  const lines = [`${VERDICT_EMOJI[result.verdict]} <b>${escapeHtml(VERDICT_COPY[result.verdict].label)}</b>`, escapeHtml(result.headline), ""];

  if (result.flags.length) {
    lines.push("<b>Why</b>");
    result.flags.forEach((flag, i) => {
      const label = flag.source === "ai" ? "" : ` <i>(${escapeHtml(SOURCE_COPY[flag.source].toLowerCase())})</i>`;
      lines.push(`${i + 1}. ${escapeHtml(flag.reason)}${label}`);
    });
    lines.push("");
  }
  if (result.advice.length) {
    lines.push("<b>What to do now</b>");
    for (const step of result.advice) lines.push(`• ${escapeHtml(step)}`);
    lines.push("");
  }
  if (result.verdict === "no_red_flags") {
    lines.push("<i>No red flags is not a guarantee. If it asks for money, codes or passwords, contact the company or person using a number you already trust.</i>", "");
    lines.push(`Result page: ${warningUrl}`);
  } else {
    lines.push("<b>Warn your family:</b> forward this message, or send them the link:", warningUrl);
  }
  return lines.join("\n");
}

const WELCOME = [
  "👋 <b>ScamCheck</b>",
  "",
  "Forward me any message that feels off, or send a screenshot of it. In a few seconds I'll tell you if it looks like a scam and why, and give you a warning you can pass on to your family.",
  "",
  "I never call a message safe: nobody can know for sure who sent it. Please don't send passwords, PINs or full card numbers.",
].join("\n");

type Fetch = typeof fetch;

async function downloadImage(token: string, fileId: string, fetchImpl: Fetch): Promise<string | null> {
  const file = await telegramCall<{ file_path?: string; file_size?: number }>(token, "getFile", { file_id: fileId }, fetchImpl);
  if (!file.file_path || (file.file_size ?? 0) > MAX_IMAGE_BYTES) return null;
  const res = await fetchImpl(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length > MAX_IMAGE_BYTES ? null : bytes.toString("base64");
}

/** Handles one update: /start, a forwarded or typed message, or a screenshot. Private chats only. */
export async function handleUpdate(update: TelegramUpdate, deps: BotDeps): Promise<void> {
  const message = update.message;
  if (!message || message.chat.type !== "private") return;

  const { token, origin, fetchImpl = fetch, runCheck = defaultRunCheck, signShare = defaultSignShare } = deps;
  const chatId = message.chat.id;
  const reply = (text: string, extra: Record<string, unknown> = {}) =>
    telegramCall(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_parameters: { message_id: message.message_id }, ...extra }, fetchImpl);

  const text = (message.text ?? message.caption ?? "").trim();
  if (/^\/(start|help)\b/.test(text)) {
    await reply(WELCOME, { link_preview_options: { is_disabled: true } });
    return;
  }

  const photoId = message.photo?.at(-1)?.file_id;
  const documentImage =
    message.document?.mime_type && (IMAGE_TYPES as readonly string[]).includes(message.document.mime_type) ? message.document : undefined;
  if (!text && !photoId && !documentImage) {
    await reply("Send me the message as text, forward it to me, or send a screenshot.");
    return;
  }
  if (!allowChat(String(chatId))) {
    await reply("You've checked a lot of messages in a short time. Please wait a few minutes.");
    return;
  }

  await telegramCall(token, "sendChatAction", { chat_id: chatId, action: "typing" }, fetchImpl).catch(() => {});

  try {
    let image: AnalyzeInput["image"];
    const fileId = photoId ?? documentImage?.file_id;
    if (fileId) {
      const data = await downloadImage(token, fileId, fetchImpl);
      if (!data) {
        await reply("That image is too large or couldn't be downloaded. Try a smaller screenshot, or send the text.");
        return;
      }
      image = { data, mediaType: (photoId ? "image/jpeg" : documentImage!.mime_type) as ImageType };
    }

    const result = await runCheck({ text: text.slice(0, 5000) || undefined, image, uiLanguage: message.from?.language_code || "en" });
    const warningUrl = `${origin}/v/${signShare(result)}`;
    await reply(formatVerdict(result, warningUrl), { link_preview_options: { url: warningUrl, prefer_large_media: true } });
  } catch (error) {
    const kind = error instanceof AnalysisError ? error.kind : "failed";
    console.error(`telegram check failed: ${kind}: ${error instanceof Error ? error.message : String(error)}`);
    await reply(ERROR_COPY[kind].error).catch(() => {});
  }
}

let cachedUsername: { value: string | null; expires: number } | null = null;

/** The bot's @username for links on the site, or null when no bot is set up. Cached for an hour. */
export async function botUsername(fetchImpl: Fetch = fetch): Promise<string | null> {
  const token = telegramToken();
  if (!token) return null;
  if (cachedUsername && cachedUsername.expires > Date.now()) return cachedUsername.value;
  try {
    const me = await telegramCall<{ username?: string }>(token, "getMe", {}, fetchImpl);
    cachedUsername = { value: me.username ?? null, expires: Date.now() + 60 * 60 * 1000 };
  } catch {
    cachedUsername = { value: null, expires: Date.now() + 60 * 1000 };
  }
  return cachedUsername.value;
}
