import { describe, expect, it, vi } from "vitest";
import { AnalysisError } from "@/lib/ai-shared";
import { escapeHtml, formatVerdict, handleUpdate, webhookSecret, type TelegramUpdate } from "@/lib/telegram";
import type { CheckResult } from "@/lib/schema";
import { sampleResult } from "./fixtures";

const ORIGIN = "https://scamcheck.test";

/** A fake Telegram API that records every call. */
function fakeTelegram() {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (url.includes("/file/bot")) return new Response(new Uint8Array([1, 2, 3]));
    const method = url.split("/").pop()!;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ method, body });
    const result = method === "getFile" ? { file_path: "photos/file_1.jpg", file_size: 3 } : true;
    return Response.json({ ok: true, result });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

let nextChat = 1000;
function update(message: Partial<NonNullable<TelegramUpdate["message"]>>): TelegramUpdate {
  return { update_id: 1, message: { message_id: 7, chat: { id: nextChat++, type: "private" }, from: { language_code: "hi" }, ...message } };
}

describe("formatVerdict", () => {
  it("escapes HTML, labels checked facts and ends with the warning link", () => {
    const result: CheckResult = {
      ...sampleResult,
      headline: "Fake <b>bank</b> alert",
      flags: [
        { quote: "", reason: "Asks you to move money", source: "ai" },
        { quote: "", reason: "Domain registered 2 days ago", source: "domain_registry" },
      ],
    };
    const text = formatVerdict(result, `${ORIGIN}/v/abc`);
    expect(text).toContain("⚠️ <b>Likely scam</b>");
    expect(text).toContain("Fake &lt;b&gt;bank&lt;/b&gt; alert");
    expect(text).toContain("2. Domain registered 2 days ago <i>(checked: domain registry)</i>");
    expect(text.trim().endsWith(`${ORIGIN}/v/abc`)).toBe(true);
  });

  it("frames a clean result as a result page, with the not-a-guarantee note", () => {
    const text = formatVerdict({ ...sampleResult, verdict: "no_red_flags", flags: [] }, `${ORIGIN}/v/x`);
    expect(text).toContain("✅ <b>No red flags found</b>");
    expect(text).toContain("not a guarantee");
    expect(text).not.toContain("Warn your family");
  });

  it("escapes only what Telegram's HTML mode needs", () => {
    expect(escapeHtml(`a < b & "c"`)).toBe(`a &lt; b &amp; "c"`);
  });
});

describe("handleUpdate", () => {
  it("answers /start with how to use the bot, without running a check", async () => {
    const { calls, fetchImpl } = fakeTelegram();
    const runCheck = vi.fn();
    await handleUpdate(update({ text: "/start" }), { token: "T", origin: ORIGIN, fetchImpl, runCheck });
    expect(runCheck).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("sendMessage");
    expect(String(calls[0].body.text)).toContain("Forward me any message");
  });

  it("checks a forwarded message and replies with the verdict and a signed warning link", async () => {
    const { calls, fetchImpl } = fakeTelegram();
    const runCheck = vi.fn(async () => sampleResult);
    await handleUpdate(update({ text: "Your power will be cut tonight" }), {
      token: "T",
      origin: ORIGIN,
      fetchImpl,
      runCheck,
      signShare: () => "signed-token",
    });

    expect(runCheck).toHaveBeenCalledWith({ text: "Your power will be cut tonight", image: undefined, uiLanguage: "hi" });
    expect(calls.map((c) => c.method)).toEqual(["sendChatAction", "sendMessage"]);
    const sent = calls[1].body;
    expect(sent.parse_mode).toBe("HTML");
    expect(String(sent.text)).toContain(sampleResult.headline);
    expect(String(sent.text)).toContain(`${ORIGIN}/v/signed-token`);
    expect(sent.link_preview_options).toEqual({ url: `${ORIGIN}/v/signed-token`, prefer_large_media: true });
    expect(sent.reply_parameters).toEqual({ message_id: 7 });
  });

  it("downloads a screenshot and checks it together with its caption", async () => {
    const { calls, fetchImpl } = fakeTelegram();
    const runCheck = vi.fn(async () => sampleResult);
    await handleUpdate(
      update({
        caption: "is this real?",
        photo: [
          { file_id: "small", width: 90, height: 160 },
          { file_id: "large", width: 720, height: 1280 },
        ],
      }),
      { token: "T", origin: ORIGIN, fetchImpl, runCheck, signShare: () => "s" },
    );

    expect(calls.find((c) => c.method === "getFile")?.body).toEqual({ file_id: "large" });
    expect(runCheck).toHaveBeenCalledWith({
      text: "is this real?",
      image: { data: Buffer.from([1, 2, 3]).toString("base64"), mediaType: "image/jpeg" },
      uiLanguage: "hi",
    });
  });

  it("ignores group chats", async () => {
    const { calls, fetchImpl } = fakeTelegram();
    await handleUpdate(
      { update_id: 1, message: { message_id: 1, chat: { id: 5, type: "group" }, text: "hello" } },
      { token: "T", origin: ORIGIN, fetchImpl, runCheck: vi.fn() },
    );
    expect(calls).toEqual([]);
  });

  it("explains what to send when the message has no text or image", async () => {
    const { calls, fetchImpl } = fakeTelegram();
    await handleUpdate(update({}), { token: "T", origin: ORIGIN, fetchImpl, runCheck: vi.fn() });
    expect(String(calls[0].body.text)).toContain("send a screenshot");
  });

  it("replies with a friendly message when the AI is busy", async () => {
    const { calls, fetchImpl } = fakeTelegram();
    const runCheck = vi.fn(async () => {
      throw new AnalysisError("quota", "busy");
    });
    await handleUpdate(update({ text: "hi" }), { token: "T", origin: ORIGIN, fetchImpl, runCheck });
    expect(String(calls.at(-1)?.body.text)).toMatch(/try again in a minute/i);
  });
});

describe("POST /api/telegram", () => {
  it("rejects calls without Telegram's secret header and accepts real ones", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "bot-token");
    const handled = vi.fn(async () => {});
    vi.doMock("next/server", () => ({ after: (task: () => unknown) => void task() }));
    vi.doMock("@/lib/telegram", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/telegram")>()),
      handleUpdate: handled,
    }));
    const { POST } = await import("@/app/api/telegram/route");
    const body = JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: 1, type: "private" }, text: "hi" } });

    const forged = await POST(new Request("https://scamcheck.test/api/telegram", { method: "POST", body }));
    expect(forged.status).toBe(401);
    expect(handled).not.toHaveBeenCalled();

    const real = await POST(
      new Request("https://scamcheck.test/api/telegram", {
        method: "POST",
        body,
        headers: { "x-telegram-bot-api-secret-token": webhookSecret("bot-token") },
      }),
    );
    expect(real.status).toBe(200);
    expect(handled).toHaveBeenCalledWith(expect.objectContaining({ update_id: 1 }), { token: "bot-token", origin: "https://scamcheck.test" });
    vi.unstubAllEnvs();
  });
});
