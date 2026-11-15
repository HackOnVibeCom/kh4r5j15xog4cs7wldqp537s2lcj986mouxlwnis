import { Img } from "remotion";
import { C } from "./theme";
import type { RecEvent, Recording } from "./types";

type Move = Extract<RecEvent, { kind: "move" }>;
type Click = Extract<RecEvent, { kind: "click" }>;

/** The last recorded frame at or before a moment of the recording. */
function frameAt(rec: Recording, t: number): string {
  const frames = rec.frames;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo]!.file;
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** Where the finger is at a moment of the recording, and whether to show it. */
function touchAt(rec: Recording, t: number): { x: number; y: number; visible: number; ripple: number } {
  const moves = rec.events.filter((e): e is Move => e.kind === "move");
  const clicks = rec.events.filter((e): e is Click => e.kind === "click");
  let from = moves[0] ?? { x: 0, y: 0, t: 0, until: 0 };
  let pos = { x: from.x, y: from.y };
  let active = false;
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i]!;
    if (m.t > t) break;
    if (t < m.until) {
      const p = ease((t - m.t) / Math.max(0.01, m.until - m.t));
      pos = { x: from.x + (m.x - from.x) * p, y: from.y + (m.y - from.y) * p };
      active = true;
    } else pos = { x: m.x, y: m.y };
    from = m;
  }
  const lastClick = [...clicks].reverse().find((c) => c.t <= t);
  const since = lastClick ? t - lastClick.t : Infinity;
  const nextMove = moves.find((m) => m.t > t);
  const soon = nextMove ? nextMove.t - t : Infinity;
  const visible = active ? 1 : since < 0.9 ? 1 - Math.max(0, since - 0.6) / 0.3 : soon < 0.25 ? 1 - soon / 0.25 : 0;
  return { ...pos, visible: Math.max(0, Math.min(1, visible)), ripple: since < 0.6 ? since / 0.6 : 0 };
}

const STATUS = 44;

function StatusBar({ width }: { width: number }) {
  return (
    <div style={{ height: STATUS, width, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 30px 0", background: C.bg, fontSize: 17, fontWeight: 700, color: C.ink, fontFamily: "system-ui, sans-serif" }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ width: 18, height: 11, borderRadius: 2, background: C.ink, opacity: 0.85 }} />
        <span style={{ width: 26, height: 12, borderRadius: 4, border: `2px solid ${C.ink}`, opacity: 0.85 }} />
      </span>
    </div>
  );
}

export function Phone({ rec, recT, base, x, y, width }: { rec: Recording; recT: number; base: string; x: number; y: number; width: number }) {
  const k = width / rec.viewport.width;
  const pageHeight = rec.viewport.height * k;
  const height = pageHeight + STATUS;
  const bezel = 16;
  const touch = touchAt(rec, recT);
  return (
    <div
      style={{
        position: "absolute",
        left: x - bezel,
        top: y - bezel,
        width: width + bezel * 2,
        height: height + bezel * 2,
        borderRadius: 64,
        background: "#121214",
        boxShadow: "0 40px 90px rgba(40,20,10,0.28), 0 8px 24px rgba(40,20,10,0.18), inset 0 0 0 2px #2a2a2e",
      }}
    >
      <div style={{ position: "absolute", left: bezel, top: bezel, width, height, borderRadius: 50, overflow: "hidden", background: C.bg }}>
        <StatusBar width={width} />
        <Img src={`${base}/rec/frames/${frameAt(rec, recT)}`} style={{ width, height: pageHeight, display: "block" }} />
        {touch.visible > 0 && (
          <div
            style={{
              position: "absolute",
              left: touch.x * k - 22,
              top: STATUS + touch.y * k - 22,
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "rgba(28,27,31,0.28)",
              border: "3px solid rgba(255,255,255,0.95)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
              opacity: touch.visible,
              transform: `scale(${touch.ripple > 0 ? 0.85 : 1})`,
            }}
          />
        )}
        {touch.ripple > 0 && (
          <div
            style={{
              position: "absolute",
              left: touch.x * k - (16 + 40 * touch.ripple),
              top: STATUS + touch.y * k - (16 + 40 * touch.ripple),
              width: (16 + 40 * touch.ripple) * 2,
              height: (16 + 40 * touch.ripple) * 2,
              borderRadius: 999,
              border: `4px solid ${C.blue}`,
              opacity: 1 - touch.ripple,
            }}
          />
        )}
      </div>
      <div style={{ position: "absolute", top: bezel + 12, left: "50%", marginLeft: -60, width: 120, height: 34, borderRadius: 20, background: "#121214" }} />
    </div>
  );
}
