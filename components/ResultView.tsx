"use client";

import { useState } from "react";
import { SOURCE_COPY, VERDICT_COPY } from "@/lib/copy";
import { highlight } from "@/lib/highlight";
import type { CheckResult, LinkReport } from "@/lib/schema";

const ICON = { danger: "!", warn: "?", calm: "✓" } as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Same output on server and browser (locale formatting would differ and break hydration). */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function linkFact(link: LinkReport): string {
  if (link.lookup === "found" && link.registered) {
    const age = link.ageDays === 1 ? "1 day" : `${link.ageDays} days`;
    return `Registered ${formatDate(link.registered)}, ${age} old when checked`;
  }
  if (link.lookup === "not_found") return "The domain registry has no record of this domain";
  return "The domain registry didn't answer, so its age is unknown";
}

export function ResultView({ result }: { result: CheckResult }) {
  const [active, setActive] = useState<number | null>(null);
  const copy = VERDICT_COPY[result.verdict];
  const message = result.message;
  const flags = result.flags;
  const segments = highlight(message, flags.map((flag) => flag.quote));

  function focusFlag(index: number) {
    setActive(index);
    document.getElementById(`flag-${index}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div>
      <div className={`verdict tone-${copy.tone}`} role="status">
        <div className="verdict-icon" aria-hidden>
          {ICON[copy.tone]}
        </div>
        <div>
          <h2>{copy.label}</h2>
          <p>{result.headline}</p>
        </div>
      </div>

      {message && (
        <div className="section">
          <h3>The message</h3>
          <div className="message">
            {segments.map((segment, i) =>
              segment.flag === null ? (
                <span key={i}>{segment.text}</span>
              ) : (
                <mark key={i} onClick={() => focusFlag(segment.flag!)} title={flags[segment.flag].reason}>
                  {segment.text}
                  <sup>{segment.flag + 1}</sup>
                </mark>
              ),
            )}
          </div>
        </div>
      )}

      {flags.length > 0 && (
        <div className="section">
          <h3>Why</h3>
          <ol className="flags">
            {flags.map((flag, i) => (
              <li key={i} id={`flag-${i}`} className={`flag${active === i ? " active" : ""}`}>
                <span className="flag-num">{i + 1}</span>
                <div>
                  <div>{flag.reason}</div>
                  <span className={`badge ${flag.source === "ai" ? "badge-ai" : "badge-fact"}`}>{SOURCE_COPY[flag.source]}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.links.length > 0 && (
        <div className="section">
          <h3>Links in the message</h3>
          <ul className="links">
            {result.links.map((link) => (
              <li key={link.hostname}>
                <code>{link.url}</code>
                <small>
                  {linkFact(link)} · source: public domain registry (RDAP)
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.advice.length > 0 && (
        <div className="section">
          <h3>What to do now</h3>
          <ul className="advice">
            {result.advice.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {result.verdict === "no_red_flags" && (
        <p className="caveat">
          No red flags is not a guarantee. If a message asks for money, codes or passwords, contact the company or person directly
          using a number you already trust.
        </p>
      )}
    </div>
  );
}
