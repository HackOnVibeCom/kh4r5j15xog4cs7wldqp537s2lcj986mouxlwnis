import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ScamCheck: is this message a scam?";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#f7f5f2", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#b3261e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800 }}>!</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#1c1b1f" }}>ScamCheck</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, color: "#1c1b1f", marginTop: 40, lineHeight: 1.05 }}>Got a message that feels off?</div>
        <div style={{ fontSize: 36, color: "#5d5a63", marginTop: 24 }}>Paste it. Know in seconds if it&apos;s a scam. Free, no sign-up.</div>
      </div>
    ),
    size,
  );
}
