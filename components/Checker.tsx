"use client";

import { useRef, useState } from "react";
import { EXAMPLES, VERDICT_COPY } from "@/lib/copy";
import type { CheckResult } from "@/lib/schema";
import { ResultView } from "./ResultView";
import { ShareActions } from "./ShareActions";

interface Screenshot {
  data: string;
  mediaType: "image/jpeg";
  preview: string;
}

/** Shrinks a screenshot in the browser so uploads stay small and fast on mobile data. */
async function prepareScreenshot(file: File): Promise<Screenshot> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { data: preview.split(",")[1], mediaType: "image/jpeg", preview };
}

export function Checker() {
  const [text, setText] = useState("");
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ result: CheckResult; token: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function attach(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setScreenshot(await prepareScreenshot(file));
      setError(null);
    } catch {
      setError("That image couldn't be read. Try a PNG or JPEG screenshot.");
    }
  }

  async function check(messageText = text) {
    if (!messageText.trim() && !screenshot) {
      setError("Paste a message or add a screenshot first.");
      return;
    }
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: messageText.trim() || undefined,
          image: screenshot ? { data: screenshot.data, mediaType: screenshot.mediaType } : undefined,
          uiLanguage: navigator.language,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      setOutcome(json);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function tryExample(exampleText: string) {
    setText(exampleText);
    setScreenshot(null);
    void check(exampleText);
  }

  function reset() {
    setText("");
    setScreenshot(null);
    setOutcome(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const shareUrl = outcome && typeof window !== "undefined" ? `${window.location.origin}/v/${outcome.token}` : "";
  const shareText = outcome
    ? outcome.result.verdict === "no_red_flags"
      ? `I checked a message with ScamCheck: no red flags found. Details:`
      : `⚠️ ${VERDICT_COPY[outcome.result.verdict].short}: ${outcome.result.headline}. If you get a message like this, don't reply. Here's why:`
    : "";

  return (
    <>
      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          void check();
        }}
      >
        <label htmlFor="message" className="sr-only">
          The message you received
        </label>
        <textarea
          id="message"
          className="input-area"
          placeholder="Paste the text, WhatsApp message or email here…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const file = [...event.clipboardData.files].find((f) => f.type.startsWith("image/"));
            if (file) {
              event.preventDefault();
              void attach(file);
            }
          }}
          maxLength={5000}
        />

        {screenshot && (
          <div className="thumb">
            <img src={screenshot.preview} alt="Your screenshot" />
            <button type="button" aria-label="Remove screenshot" onClick={() => setScreenshot(null)}>
              ×
            </button>
          </div>
        )}

        <div className="row">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void attach(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={loading}>
            📷 {screenshot ? "Change screenshot" : "Add screenshot"}
          </button>
          <span className="spacer" />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Checking…" : "Check message →"}
          </button>
        </div>

        <div className="examples">
          <span>Try an example:</span>
          {EXAMPLES.map((example) => (
            <button key={example.label} type="button" className="chip" onClick={() => tryExample(example.text)} disabled={loading}>
              {example.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="loading" role="status">
            <span className="spinner" aria-hidden /> Reading the message and checking any links. This takes a few seconds.
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
      </form>

      {outcome && (
        <div ref={resultRef} className="card">
          <ResultView result={outcome.result} />

          <div className="share">
            <h3>{outcome.result.verdict === "no_red_flags" ? "Share the result" : "Warn the people you love"}</h3>
            <p>
              Scams spread through family and group chats. Send this warning the same way. Personal details are hidden and links
              can't be clicked.
            </p>
            <ShareActions url={shareUrl} text={shareText} />
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-block" onClick={reset}>
              Check another message
            </button>
          </div>
        </div>
      )}
    </>
  );
}
