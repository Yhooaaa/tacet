import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
        <svg width="120" height="120" viewBox="0 0 20 20" fill="#fff">
          <circle cx="6" cy="10" r="4.5" />
          <circle cx="13.5" cy="6" r="1.6" opacity="0.75" />
          <circle cx="14" cy="13.5" r="1.3" opacity="0.55" />
          <circle cx="18" cy="9.5" r="1" opacity="0.4" />
        </svg>
      </div>
    ),
    size,
  );
}
