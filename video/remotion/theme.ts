import { loadFont } from "@remotion/google-fonts/Inter";

export const font = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;

/** ScamCheck's own palette, from the site's light theme. */
export const C = {
  bg: "#f7f5f2",
  bg2: "#efe9e1",
  surface: "#ffffff",
  ink: "#1c1b1f",
  muted: "#8a8690",
  red: "#b3261e",
  redSoft: "#fbe9e7",
  blue: "#2f4fd8",
  green: "#1f6b45",
  greenSoft: "#e3f4ea",
  purple: "#5a3fb3",
  chat: "#e9e4dc",
} as const;

export const W = 1920;
export const H = 1080;
