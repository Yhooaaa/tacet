import { ImageResponse } from "next/og";

export const alt = "Tacet: see what the internet knows about you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#000", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 20 20" fill="#fff">
            <circle cx="6" cy="10" r="4.5" />
            <circle cx="13.5" cy="6" r="1.6" opacity="0.75" />
            <circle cx="14" cy="13.5" r="1.3" opacity="0.55" />
            <circle cx="18" cy="9.5" r="1" opacity="0.4" />
          </svg>
          <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>Tacet</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 92, fontWeight: 600, lineHeight: 1, letterSpacing: -3 }}>You&rsquo;re louder</span>
          <span style={{ fontSize: 92, fontWeight: 600, lineHeight: 1, letterSpacing: -3 }}>than you think.</span>
          <span style={{ marginTop: 36, fontSize: 32, color: "rgba(255,255,255,0.6)" }}>See what the internet knows about you, and how to remove it.</span>
        </div>
      </div>
    ),
    size,
  );
}
