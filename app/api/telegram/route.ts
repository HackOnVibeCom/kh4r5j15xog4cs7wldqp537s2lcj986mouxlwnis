import { after } from "next/server";
import { handleUpdate, telegramToken, webhookSecret, type TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Telegram calls this for every message sent to the bot. We answer 200 at once so Telegram
 * doesn't retry, and do the check after the response with Next's after().
 */
export async function POST(request: Request): Promise<Response> {
  const token = telegramToken();
  if (!token) return new Response("Bot not configured", { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret(token)) {
    return new Response("Forbidden", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const origin = new URL(request.url).origin;
  after(() =>
    handleUpdate(update, { token, origin }).catch((error) => console.error("telegram update failed", error)),
  );
  return new Response("ok");
}
