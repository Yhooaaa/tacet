import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Tacet: see what the internet knows about you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const mark = await readFile(join(process.cwd(), "src/components/layout/mark.png"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#000", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={`data:image/png;base64,${mark.toString("base64")}`} width={66} height={56} alt="" />
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
