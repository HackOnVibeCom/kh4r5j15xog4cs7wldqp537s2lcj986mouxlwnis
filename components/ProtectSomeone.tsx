"use client";

import { useState } from "react";
import { ShareActions } from "./ShareActions";

/** Lets someone set the checker up for a parent or friend: the link greets them by the sender's name. */
export function ProtectSomeone() {
  const [name, setName] = useState("");
  const trimmed = name.trim().slice(0, 40);
  const url = typeof window !== "undefined" && trimmed ? `${window.location.origin}/?from=${encodeURIComponent(trimmed)}` : "";

  return (
    <section className="protect">
      <h2>Set it up for someone you worry about</h2>
      <p>Send a parent or grandparent a link that says it&apos;s from you, so they check a message before they click, call back or pay.</p>
      <div className="row">
        <label htmlFor="from-name" className="sr-only">
          Your name
        </label>
        <input id="from-name" placeholder="Your name, e.g. Priya" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
      </div>
      {url && (
        <div style={{ marginTop: 12 }}>
          <ShareActions url={url} text={`I set this up for you: if a message ever looks odd, paste it here before you do anything. It's free. – ${trimmed}`} />
        </div>
      )}
    </section>
  );
}
