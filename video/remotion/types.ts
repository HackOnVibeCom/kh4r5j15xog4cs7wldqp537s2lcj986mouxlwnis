export interface Word {
  text: string;
  /** Seconds from the start of the line's audio. */
  start: number;
  end: number;
}

export interface LineProps {
  key: string;
  text: string;
  file: string;
  /** Seconds from the start of the video. */
  at: number;
  duration: number;
  words: Word[];
}

export interface SceneProps {
  key: string;
  kind: "intro" | "rec" | "card";
  graphic?: string;
  label?: string;
  start: number;
  end: number;
  /** For recording scenes: the stretch of the recording (seconds) played over the scene. */
  part?: { recStart: number; recEnd: number };
}

export type RecEvent =
  | { kind: "mark"; t: number; name: string }
  | { kind: "move"; t: number; until: number; x: number; y: number }
  | { kind: "click"; t: number; x: number; y: number };

export interface Recording {
  viewport: { width: number; height: number };
  scale: number;
  frames: { t: number; file: string }[];
  events: RecEvent[];
}

// Composition props must be a type alias (Remotion needs them indexable).
export type VideoProps = {
  /** Where the .out folder is served during the render. */
  base: string;
  fps: number;
  durationInFrames: number;
  lines: LineProps[];
  scenes: SceneProps[];
  rec: Recording;
  preview: string;
  previewUrl: string;
  telegramText: string;
  parcelMessage: string;
  site: string;
  bot: string;
};
