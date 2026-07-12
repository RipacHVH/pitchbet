import { ImageResponse } from "next/og";

export const alt = "Futcaster — free football prediction game on real matches";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card: wordmark, tagline, and the three modes. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 35% 20%, #41318c 0%, #140e33 70%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 110, fontWeight: 900, fontStyle: "italic", letterSpacing: -3 }}>
          <span style={{ color: "#ffffff" }}>FUT</span>
          <span style={{ color: "#ffc93c" }}>CASTER</span>
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 34, fontWeight: 700, color: "#c9c2ea" }}>
          Call it before kickoff — real matches, real odds, zero real money
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 54 }}>
          {["⚔️ Ranked 1v1 Showdown", "🏟️ Friends Leagues", "🎡 Daily Spin"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "16px 30px",
                borderRadius: 22,
                border: "3px solid rgba(255, 201, 60, 0.55)",
                background: "rgba(29, 19, 71, 0.85)",
                color: "#ffffff",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
