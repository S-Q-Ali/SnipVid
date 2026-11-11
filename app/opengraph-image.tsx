import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "SnipVid — Download Instagram Posts, Reels, Photos & Carousels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#F8FAFC",
          color: "#0F172A",
          fontFamily: "system-ui, sans-serif",
          borderTop: "12px solid #1456E3",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              backgroundColor: "#1456E3",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            S
          </div>
          <span style={{ fontSize: "34px", fontWeight: 700, letterSpacing: "-0.03em" }}>
            {SITE_NAME}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "960px" }}>
          <div
            style={{
              fontSize: "62px",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            Save Instagram Posts, Reels, Photos & Carousels.
          </div>
          <div style={{ fontSize: "28px", color: "#475569", lineHeight: 1.4 }}>
            Paste any public Instagram link, inspect each item, and download clean MP4 videos or JPG images — no login required.
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", fontSize: "22px", color: "#334155" }}>
          <span
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #CBD5E1",
              borderRadius: "9999px",
              padding: "10px 22px",
            }}
          >
            H.264 MP4 Reels
          </span>
          <span
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #CBD5E1",
              borderRadius: "9999px",
              padding: "10px 22px",
            }}
          >
            JPG Photo Posts
          </span>
          <span
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #CBD5E1",
              borderRadius: "9999px",
              padding: "10px 22px",
            }}
          >
            100% Anonymous
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
