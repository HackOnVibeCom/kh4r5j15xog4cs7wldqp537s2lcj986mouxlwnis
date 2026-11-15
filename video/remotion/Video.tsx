import { AbsoluteFill, Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { BigNumber, Close, Hook, Logo, Mark, PreviewCard, TelegramCard } from "./Graphics";
import { Phone } from "./Phone";
import { C, font } from "./theme";
import type { LineProps, SceneProps, VideoProps } from "./types";

const GAP = 0.35;

function Background() {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, left: -200 + drift, top: -300, background: "radial-gradient(circle, rgba(179,38,30,0.10), rgba(179,38,30,0) 70%)" }} />
      <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: 999, right: -300 - drift, bottom: -420, background: "radial-gradient(circle, rgba(47,79,216,0.10), rgba(47,79,216,0) 70%)" }} />
    </AbsoluteFill>
  );
}

/** The narration line with each word darkening as it is spoken. */
function Caption({ line, t, size, align }: { line: LineProps; t: number; size: number; align: "left" | "center" }) {
  const local = t - line.at;
  return (
    <div style={{ fontFamily: font, fontSize: size, lineHeight: 1.3, fontWeight: 600, textAlign: align, letterSpacing: -0.5 }}>
      {line.words.map((w, i) => (
        <span key={i} style={{ color: local >= w.start - 0.05 ? C.ink : "rgba(28,27,31,0.28)" }}>
          {w.text}{" "}
        </span>
      ))}
    </div>
  );
}

function activeScene(scenes: SceneProps[], t: number): SceneProps {
  let current = scenes[0]!;
  for (const s of scenes) if (s.start <= t) current = s;
  return current;
}

function recTime(scene: SceneProps, t: number): number {
  const { recStart, recEnd } = scene.part!;
  const p = Math.max(0, Math.min(1, (t - scene.start) / (scene.end - scene.start)));
  return recStart + p * (recEnd - recStart);
}

/** Fades the phone in when a run of recording scenes starts and out when it ends. */
function phoneOpacity(scenes: SceneProps[], t: number): number {
  const i = scenes.findIndex((s) => s.start <= t && t < s.end + GAP);
  if (i < 0 || scenes[i]!.kind !== "rec") return 0;
  let first = i;
  while (first > 0 && scenes[first - 1]!.kind === "rec") first--;
  let last = i;
  while (last < scenes.length - 1 && scenes[last + 1]!.kind === "rec") last++;
  const fadeIn = (t - scenes[first]!.start) / 0.35;
  const fadeOut = (scenes[last]!.end + GAP - t) / 0.3;
  return Math.max(0, Math.min(1, fadeIn, fadeOut));
}

function Graphic({ scene, props }: { scene: SceneProps; props: VideoProps }) {
  switch (scene.graphic) {
    case "text":
      return <Hook />;
    case "number":
      return <BigNumber />;
    case "logo":
      return <Logo site={props.site} />;
    case "preview":
      return <PreviewCard base={props.base} preview={props.preview} url={props.previewUrl} />;
    case "telegram":
      return <TelegramCard text={props.telegramText} message={props.parcelMessage} bot={props.bot} />;
    default:
      return <Close site={props.site} bot={props.bot} />;
  }
}

function FadeInOut({ length, children }: { length: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.3 * fps, (length - 0.3) * fps, length * fps], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function Video(props: VideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scene = activeScene(props.scenes, t);
  const line = [...props.lines].reverse().find((l) => l.at <= t + 0.05 && t < l.at + l.duration + 0.6);
  const recScenes = props.scenes.filter((s) => s.kind === "rec");
  const step = recScenes.findIndex((s) => s.key === scene.key) + 1;
  const phoneAlpha = phoneOpacity(props.scenes, t);
  const lastRec = [...recScenes].reverse().find((s) => s.start <= t) ?? recScenes[0]!;

  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <Background />

      {props.lines.map((l) => (
        <Sequence key={l.key} from={Math.round(l.at * fps)} durationInFrames={Math.ceil((l.duration + 0.3) * fps)}>
          <Audio src={`${props.base}/${l.file}`} volume={1.6} />
        </Sequence>
      ))}

      {props.scenes
        .filter((s) => s.kind !== "rec")
        .map((s) => (
          <Sequence key={s.key} from={Math.round(s.start * fps)} durationInFrames={Math.ceil((s.end - s.start + GAP) * fps)}>
            <FadeInOut length={s.end - s.start + GAP}>
              <Graphic scene={s} props={props} />
            </FadeInOut>
          </Sequence>
        ))}

      {phoneAlpha > 0 && (
        <AbsoluteFill style={{ opacity: phoneAlpha }}>
          <Phone rec={props.rec} recT={recTime(lastRec, t)} base={props.base} x={300} y={58} width={420} />
          <div style={{ position: "absolute", left: 900, top: 250, width: 880 }}>
            {scene.kind === "rec" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "12px 26px 12px 14px", borderRadius: 999, background: C.surface, boxShadow: "0 6px 20px rgba(40,20,10,0.08)", marginBottom: 34 }}>
                <span style={{ width: 52, height: 52, borderRadius: 999, background: C.red, color: "#fff", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{step}</span>
                <span style={{ fontSize: 32, fontWeight: 700, color: C.ink }}>{scene.label}</span>
              </div>
            )}
            {line && props.scenes.find((s) => s.key === line.key)?.kind === "rec" && <Caption line={line} t={t} size={54} align="left" />}
          </div>
          <div style={{ position: "absolute", right: 70, bottom: 56, display: "flex", alignItems: "center", gap: 14 }}>
            <Mark size={44} />
            <span style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>{props.site}</span>
          </div>
        </AbsoluteFill>
      )}

      {line && props.scenes.find((s) => s.key === line.key)?.kind !== "rec" && (
        <div style={{ position: "absolute", left: 160, right: 160, bottom: 64, display: "flex", justifyContent: "center" }}>
          <div style={{ background: "rgba(255,255,255,0.86)", borderRadius: 24, padding: "18px 32px", boxShadow: "0 8px 30px rgba(40,20,10,0.08)" }}>
            <Caption line={line} t={t} size={40} align="center" />
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}
