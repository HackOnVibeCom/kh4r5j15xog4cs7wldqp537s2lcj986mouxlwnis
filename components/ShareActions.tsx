"use client";

import { useState } from "react";

interface Props {
  url: string;
  text: string;
}

/** WhatsApp first (where family scams travel), then the phone's share sheet, then copy. */
export function ShareActions({ url, text }: Props) {
  const [copied, setCopied] = useState(false);
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");
  const message = `${text}\n${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function share() {
    try {
      await navigator.share({ text, url });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  return (
    <div className="row">
      <a className="btn btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        Send on WhatsApp
      </a>
      {canShare && (
        <button type="button" className="btn" onClick={share}>
          Share…
        </button>
      )}
      <button type="button" className="btn" onClick={copy} aria-live="polite">
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
