import { ImageResponse } from "next/og";
import { VERDICT_COPY } from "@/lib/copy";
import { verifyShare } from "@/lib/token";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ScamCheck warning";

const COLORS = {
  danger: { bg: "#b3261e", soft: "#fbe9e7" },
  warn: { bg: "#8a5300", soft: "#fff3d6" },
  calm: { bg: "#2f5d50", soft: "#e5f1ec" },
} as const;

/** The card WhatsApp, iMessage and others show when a warning link is shared. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const result = verifyShare((await params).token);
  const tone = result ? VERDICT_COPY[result.verdict].tone : "warn";
  const color = COLORS[tone];
  const label = result ? VERDICT_COPY[result.verdict].short.toUpperCase() : "CHECK BEFORE YOU ACT";
  const headline = result?.headline ?? "Got a message that feels off?";
  const reasons = (result?.flags ?? []).slice(0, 2).map((flag) => flag.reason);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: color.soft, padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: color.bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 800 }}>
            {tone === "calm" ? "✓" : "!"}
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: color.bg, letterSpacing: 2 }}>{label}</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, color: "#1c1b1f", marginTop: 36, lineHeight: 1.1 }}>{headline}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, gap: 12 }}>
          {reasons.map((reason, i) => (
            <div key={i} style={{ fontSize: 30, color: "#3a3940", display: "flex" }}>
              {`• ${reason.length > 110 ? `${reason.slice(0, 107)}…` : reason}`}
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", fontSize: 28, color: "#5d5a63", display: "flex" }}>ScamCheck · check any message free, no sign-up</div>
      </div>
    ),
    size,
  );
}
