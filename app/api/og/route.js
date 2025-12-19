import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  
  // Weather card (original)
  const temp = searchParams.get("temp");
  const condition = searchParams.get("condition");
  const location = searchParams.get("location");

  // Signal card (new)
  const title = searchParams.get("title");
  const side = searchParams.get("side");
  const venue = searchParams.get("venue");
  const confidence = searchParams.get("confidence");
  const tier = searchParams.get("tier");
  const accuracy = searchParams.get("accuracy");

  // If signal card params, generate signal card
  if (title && side) {
    return generateSignalCard(title, side, venue, confidence, tier, accuracy);
  }

  // Otherwise, generate weather card
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "black",
          color: "white",
          padding: "20px",
        }}
      >
        <h1 style={{ fontSize: "80px" }}>{location}</h1>
        <h2 style={{ fontSize: "120px" }}>{temp}°</h2>
        <p style={{ fontSize: "40px" }}>{condition}</p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function generateSignalCard(title, side, venue, confidence, tier, accuracy) {
  const bgColor = side === "YES" ? "#10b981" : "#ef4444";
  const emoji = side === "YES" ? "📈" : "📉";
  const confidenceEmoji = {
    "very-high": "🔥",
    "high": "✨",
    "medium": "📊",
    "low": "❓",
    "very-low": "🤔",
  }[confidence] || "📊";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1f2937",
          color: "white",
          padding: "40px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header with tier */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <span style={{ fontSize: "36px" }}>{tier}</span>
          <span style={{ fontSize: "24px", opacity: "0.7" }}>{accuracy}% accuracy</span>
        </div>

        {/* Main prediction */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1
            style={{
              fontSize: "64px",
              margin: "0 0 20px 0",
              fontWeight: "300",
            }}
          >
            {emoji} {side.toUpperCase()}
          </h1>
          <p
            style={{
              fontSize: "48px",
              margin: "0 0 10px 0",
              fontWeight: "300",
              maxWidth: "1000px",
            }}
          >
            {title.substring(0, 60)}
          </p>
          <p
            style={{
              fontSize: "24px",
              opacity: "0.6",
              margin: "0",
            }}
          >
            📍 {venue || "Location"}
          </p>
        </div>

        {/* Confidence + venue */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px 24px",
            borderRadius: "12px",
            backgroundColor: `${bgColor}33`,
            border: `2px solid ${bgColor}80`,
          }}
        >
          <span style={{ fontSize: "32px" }}>{confidenceEmoji}</span>
          <span style={{ fontSize: "20px" }}>{confidence || "Medium"} Confidence</span>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "60px",
            opacity: "0.5",
            fontSize: "18px",
          }}
        >
          Powered by @fourcast 🌤️
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
