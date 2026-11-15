import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for phones: the same red "!" mark as the favicon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#b3261e" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 28, height: 80, borderRadius: 14, background: "#fff" }} />
          <div style={{ width: 30, height: 30, borderRadius: 15, background: "#fff" }} />
        </div>
      </div>
    ),
    size,
  );
}
