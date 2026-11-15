import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, font } from "./theme";

const appear = (frame: number, fps: number, delay = 0) => spring({ frame: frame - delay * fps, fps, config: { damping: 18, stiffness: 120 } });

export function Mark({ size = 120 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: C.red, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: size * 0.08, boxShadow: "0 18px 40px rgba(179,38,30,0.35)" }}>
      <div style={{ width: size * 0.16, height: size * 0.44, borderRadius: size, background: "#fff" }} />
      <div style={{ width: size * 0.17, height: size * 0.17, borderRadius: size, background: "#fff" }} />
    </div>
  );
}

/** Opening: the kind of text people actually get. */
export function Hook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = appear(frame, fps, 0.15);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div
        style={{
          width: 980,
          borderRadius: 36,
          background: "rgba(255,255,255,0.92)",
          boxShadow: `0 30px 80px rgba(40,20,10,0.22), 0 0 0 ${6 + pulse * 6}px rgba(179,38,30,${0.1 + pulse * 0.08})`,
          padding: "34px 40px",
          transform: `translateY(${(1 - s) * -160}px) scale(${0.92 + s * 0.08})`,
          opacity: s,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: C.muted, fontSize: 28, fontWeight: 600 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#34c759" }} />
          MESSAGES · now
        </div>
        <div style={{ marginTop: 14, fontSize: 34, fontWeight: 700, color: C.ink }}>+91 90000 00000</div>
        <div style={{ marginTop: 8, fontSize: 38, lineHeight: 1.35, color: C.ink }}>
          Dear Consumer, your electricity will be disconnected <b>tonight at 9:30 PM</b>. Call our officer immediately to avoid disconnection.
        </div>
      </div>
    </div>
  );
}

/** The scale of the problem, with its source on screen. */
export function BigNumber() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0.2 * fps, 2.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - Math.pow(1 - p, 3);
  const value = (12.5 * eased).toFixed(1);
  const s = appear(frame, fps, 0.1);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font, opacity: s }}>
      <div style={{ fontSize: 210, fontWeight: 800, color: C.red, letterSpacing: -6, lineHeight: 1 }}>${value} billion</div>
      <div style={{ marginTop: 26, fontSize: 52, fontWeight: 600, color: C.ink }}>reported lost to fraud by Americans in 2024</div>
      <div style={{ marginTop: 18, fontSize: 30, color: C.muted }}>Source: U.S. Federal Trade Commission, March 2025</div>
    </div>
  );
}

export function Logo({ site }: { site: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = appear(frame, fps, 0.1);
  const t = appear(frame, fps, 0.5);
  const pills = ["Free", "No sign-up", "Any language", "Any phone"];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `scale(${0.8 + s * 0.2})`, opacity: s }}>
        <Mark size={150} />
        <div style={{ fontSize: 150, fontWeight: 800, color: C.ink, letterSpacing: -4 }}>ScamCheck</div>
      </div>
      <div style={{ marginTop: 34, fontSize: 52, color: C.ink, opacity: t, transform: `translateY(${(1 - t) * 20}px)` }}>Know in seconds if a message is a scam, and why.</div>
      <div style={{ display: "flex", gap: 18, marginTop: 36 }}>
        {pills.map((label, i) => {
          const a = appear(frame, fps, 0.8 + i * 0.12);
          return (
            <div key={label} style={{ fontSize: 34, fontWeight: 600, padding: "12px 26px", borderRadius: 999, background: C.surface, border: `2px solid ${C.bg2}`, color: C.ink, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
              {label}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 40, fontSize: 36, fontWeight: 700, color: C.blue, opacity: appear(frame, fps, 1.4) }}>{site}</div>
    </div>
  );
}

/** How the warning link shows up in a chat: the real preview card the site generates. */
export function PreviewCard({ base, preview, url }: { base: string; preview: string; url: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = appear(frame, fps, 0.1);
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, paddingBottom: 150 }}>
      <div style={{ width: 900, padding: 30, borderRadius: 40, background: C.chat, boxShadow: "0 30px 80px rgba(40,20,10,0.2)" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.muted, marginBottom: 18 }}>Family group</div>
        <div style={{ marginLeft: "auto", width: 740, background: "#d9fdd3", borderRadius: 28, padding: 16, transform: `translateY(${(1 - s) * 80}px)`, opacity: s, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
          <div style={{ borderRadius: 18, overflow: "hidden", background: "#fff" }}>
            <Img src={`${base}/${preview}`} style={{ width: "100%", display: "block" }} />
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>⚠️ Likely scam: Fake USPS package delivery notice</div>
              <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>{host}</div>
            </div>
          </div>
          <div style={{ fontSize: 28, color: C.ink, padding: "14px 6px 4px" }}>⚠️ Likely scam. If you get a message like this, don&apos;t reply. Here&apos;s why 👇</div>
        </div>
      </div>
    </div>
  );
}

/** Turns the bot's Telegram HTML into styled lines. */
function telegramLines(html: string) {
  return html.split("\n").map((line) => {
    const parts: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
    const re = /<(b|i)>(.*?)<\/\1>/g;
    let last = 0;
    for (let m = re.exec(line); m; m = re.exec(line)) {
      if (m.index > last) parts.push({ text: line.slice(last, m.index) });
      parts.push({ text: m[2]!, bold: m[1] === "b", italic: m[1] === "i" });
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push({ text: line.slice(last) });
    return parts.map((p) => ({ ...p, text: p.text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") }));
  });
}

/** The bot's real reply format for the same check, in a chat. */
export function TelegramCard({ text, message, bot }: { text: string; message: string; bot: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = appear(frame, fps, 0.1);
  const b = appear(frame, fps, 1.1);
  const lines = telegramLines(text.replace(/https?:\/\/\S+/g, (u) => `${u.slice(0, 44)}…`)).slice(0, 17);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", fontFamily: font, paddingTop: 40 }}>
      <div style={{ width: 1180, height: 820, borderRadius: 40, background: "#dfe7ef", boxShadow: "0 30px 80px rgba(20,30,50,0.22)", overflow: "hidden", position: "relative" }}>
        <div style={{ height: 96, background: "#fff", display: "flex", alignItems: "center", gap: 18, padding: "0 32px", borderBottom: "1px solid #d5dde6" }}>
          <Mark size={56} />
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>ScamCheck</div>
            <div style={{ fontSize: 22, color: C.muted }}>@{bot} · bot</div>
          </div>
        </div>
        <div style={{ position: "absolute", right: 32, top: 116, width: 640, background: "#e2ffc7", borderRadius: 24, padding: "16px 22px", opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
          <div style={{ fontSize: 20, color: "#4a8f3c", fontWeight: 600 }}>Forwarded message</div>
          <div style={{ fontSize: 24, color: C.ink, marginTop: 6, lineHeight: 1.35 }}>{message.slice(0, 150)}</div>
        </div>
        <div style={{ position: "absolute", left: 32, top: 300, width: 940, background: "#fff", borderRadius: 24, padding: "18px 24px", opacity: b, transform: `translateY(${(1 - b) * 40}px)` }}>
          {lines.map((parts, i) => (
            <div key={i} style={{ fontSize: 21, lineHeight: 1.34, color: C.ink, minHeight: 12 }}>
              {parts.map((p, j) => (
                <span key={j} style={{ fontWeight: p.bold ? 700 : 400, fontStyle: p.italic ? "italic" : "normal", color: p.italic ? C.green : undefined }}>
                  {p.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Close({ site, bot }: { site: string; bot: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = appear(frame, fps, 0.1);
  const t = appear(frame, fps, 0.6);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: s, transform: `scale(${0.85 + s * 0.15})` }}>
        <Mark size={120} />
        <div style={{ fontSize: 120, fontWeight: 800, color: C.ink, letterSpacing: -3 }}>ScamCheck</div>
      </div>
      <div style={{ marginTop: 26, fontSize: 64, fontWeight: 700, color: C.red, opacity: t }}>Check before you click.</div>
      <div style={{ marginTop: 44, fontSize: 52, fontWeight: 700, color: C.blue, opacity: appear(frame, fps, 1.0) }}>{site}</div>
      <div style={{ marginTop: 16, fontSize: 36, color: C.ink, opacity: appear(frame, fps, 1.3) }}>On Telegram: @{bot}</div>
      <div style={{ marginTop: 40, fontSize: 28, color: C.muted, opacity: appear(frame, fps, 1.6) }}>Free · No sign-up · Built for HackOnVibe, November 2026</div>
    </div>
  );
}
