import { createRateLimiter } from "@/lib/ratelimit";
import { telegramCall, telegramToken, webhookSecret } from "@/lib/telegram";

export const runtime = "nodejs";

const allow = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

/**
 * Open once after adding TELEGRAM_BOT_TOKEN on Vercel: points the bot at this site and sets its
 * commands and description. Safe to reopen; it only ever points the bot at this same site.
 */
export async function GET(request: Request): Promise<Response> {
  const token = telegramToken();
  if (!token) return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set on the server." }, { status: 503 });
  if (!allow(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local")) {
    return Response.json({ ok: false, error: "Try again in a few minutes." }, { status: 429 });
  }

  const webhookUrl = `${new URL(request.url).origin}/api/telegram`;
  try {
    const me = await telegramCall<{ username: string }>(token, "getMe", {});
    const info = await telegramCall<{ url: string }>(token, "getWebhookInfo", {});
    if (info.url !== webhookUrl) {
      await telegramCall(token, "setWebhook", {
        url: webhookUrl,
        secret_token: webhookSecret(token),
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      await telegramCall(token, "setMyCommands", { commands: [{ command: "start", description: "How to use ScamCheck" }] });
      await telegramCall(token, "setMyShortDescription", {
        short_description: "Forward a message that feels off. Know in seconds if it's a scam.",
      });
      await telegramCall(token, "setMyDescription", {
        description:
          "Forward me any message that feels off, or send a screenshot. I'll tell you if it looks like a scam and why, and give you a warning to pass on to your family. Free. I never call a message safe.",
      });
    }
    return Response.json({ ok: true, bot: `@${me.username}`, webhook: webhookUrl, changed: info.url !== webhookUrl });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Setup failed." }, { status: 502 });
  }
}
