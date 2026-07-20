import { ImageResponse } from "@vercel/og";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "landing") {
    return renderLandingOG();
  }

  if (type === "signal") {
    return renderSignalOG(searchParams);
  }

  if (type === "operator") {
    return renderOperatorOG(searchParams);
  }

  return renderWeatherOG(searchParams);
}

/**
 * OG card for the Fourcast landing page
 */
function renderLandingOG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          backgroundColor: "#080a0d",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: "54px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 0%, rgba(16,185,129,0.32), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.08), transparent 30%, rgba(245,158,11,0.12) 78%, transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div style={{ display: "flex", width: "100%", gap: "42px", position: "relative", zIndex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "42px" }}>
                <div
                  style={{
                    height: "42px",
                    width: "42px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    fontSize: "22px",
                  }}
                >
                  ◆
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>Fourcast</div>
              </div>
              <div style={{ fontSize: "64px", fontWeight: 760, lineHeight: 0.95, letterSpacing: "-0.04em" }}>
                Fourcast
              </div>
              <div style={{ marginTop: "18px", fontSize: "28px", fontWeight: 500, lineHeight: 1.25, color: "rgba(255,255,255,0.72)", maxWidth: "520px" }}>
                Find mispriced prediction markets before the crowd
              </div>
              <div style={{ marginTop: "26px", fontSize: "24px", lineHeight: 1.35, color: "rgba(255,255,255,0.66)", maxWidth: "620px" }}>
                AI fair odds vs live Polymarket and Kalshi prices — publish a trackable call.
              </div>
            </div>
            <div style={{ display: "flex", gap: "14px", color: "rgba(255,255,255,0.52)", fontSize: "18px" }}>
              <span>Search</span>
              <span>→</span>
              <span>Analyze</span>
              <span>→</span>
              <span>Publish</span>
              <span>→</span>
              <span>Track</span>
            </div>
          </div>

          <div
            style={{
              width: "430px",
              borderRadius: "26px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(13,18,22,0.92)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.42)",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#a7f3d0", fontSize: "13px", fontWeight: 800, letterSpacing: "0.18em" }}>
                  LIVE EDGE SCANNER
                </div>
                <div style={{ marginTop: "8px", fontSize: "21px", fontWeight: 650, lineHeight: 1.18 }}>
                  Bitcoin $150K market
                </div>
              </div>
              <div
                style={{
                  borderRadius: "999px",
                  padding: "8px 12px",
                  background: "rgba(16,185,129,0.14)",
                  border: "1px solid rgba(110,231,183,0.3)",
                  color: "#d1fae5",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                HIGH · BUY YES
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {[
                ["Market", "42%"],
                ["AI fair", "58.0%"],
                ["Edge", "+16.0%"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.055)",
                    padding: "16px",
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.42)", fontSize: "12px", textTransform: "uppercase" }}>{label}</div>
                  <div style={{ marginTop: "10px", fontSize: "29px", fontWeight: 760, color: label === "Edge" ? "#a7f3d0" : "white" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderRadius: "16px", background: "rgba(0,0,0,0.26)", border: "1px solid rgba(255,255,255,0.1)", padding: "18px" }}>
              {["ETF inflows · SERP API", "Institutional bid · Scraping Browser", "Macro setup · Web Unlocker"].map((item, index) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: index === 0 ? 0 : "14px" }}>
                  <div style={{ height: "9px", width: "9px", borderRadius: "99px", background: ["#22d3ee", "#34d399", "#fcd34d"][index] }} />
                  <div style={{ fontSize: "17px", color: "rgba(255,255,255,0.78)" }}>{item}</div>
                </div>
              ))}
            </div>

            <div style={{ borderRadius: "16px", background: "rgba(6,182,212,0.12)", border: "1px solid rgba(103,232,249,0.26)", padding: "18px" }}>
              <div style={{ fontSize: "17px", color: "#cffafe", fontWeight: 700 }}>AI edge detection</div>
              <div style={{ marginTop: "6px", fontSize: "14px", color: "rgba(207,250,254,0.62)" }}>
                SERP API · Scraping Browser · Web Unlocker · MCP Server
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

/**
 * OG card for per-operator Track Record URLs (/agent/[operatorId]).
 * The viral distribution surface per GTM §1 — "the OG share card on
 * Warpcast / X is our growth channel." Shows the operator's display name,
 * mandate knobs, and track record stats so a prospect seeing the card on
 * Warpcast/X immediately knows what they'd get by clicking.
 *
 * Query params:
 *   name        — operator display name (optional)
 *   total       — total forecasts
 *   resolved    — resolved forecasts
 *   brier       — avg Brier score (optional, formatted)
 *   minEdge     — mandate min edge (0-1, optional)
 *   maxAlloc    — mandate max allocation (0-1, optional)
 *   maxLoss     — mandate tail-loss limit (0-1, optional)
 *   simRuns     — mandate Monte Carlo paths (optional)
 */
function renderOperatorOG(searchParams) {
  const name = searchParams.get("name") || "Operator";
  const total = searchParams.get("total") || "0";
  const resolved = searchParams.get("resolved") || "0";
  const brier = searchParams.get("brier");
  const minEdge = searchParams.get("minEdge");
  const maxAlloc = searchParams.get("maxAlloc");
  const maxLoss = searchParams.get("maxLoss");
  const simRuns = searchParams.get("simRuns");

  const hasMandate = minEdge || maxAlloc || maxLoss;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#080a0d",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          style={{
            height: "4px",
            width: "100%",
            background: "linear-gradient(90deg, #10b981, #34d399, #6ee7b7)",
          }}
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "48px 56px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "auto" }}>
            <span style={{ fontSize: "28px", opacity: 0.5 }}>fourcast</span>
            <span
              style={{
                fontSize: "14px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: "rgba(16,185,129,0.15)",
                color: "#6ee7b7",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              Track Record
            </span>
          </div>

          <div
            style={{
              fontSize: "52px",
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: "24px",
              marginBottom: "12px",
              color: "#f1f5f9",
              letterSpacing: "-0.02em",
            }}
          >
            {name.length > 40 ? name.substring(0, 40) + "..." : name}
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "rgba(255,255,255,0.55)",
              marginBottom: "36px",
              maxWidth: "800px",
            }}
          >
            Mandate-bound track record — every number from sealed decision receipts.
          </div>

          <div style={{ display: "flex", gap: "20px", marginBottom: hasMandate ? "28px" : "0" }}>
            {[
              { label: "Forecasts", value: total },
              { label: "Resolved", value: resolved },
              { label: "Avg Brier", value: brier || "—" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "18px 24px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minWidth: "140px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {stat.label}
                </span>
                <span style={{ fontSize: "32px", fontWeight: 700, color: "white" }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {hasMandate && (
            <div
              style={{
                display: "flex",
                gap: "16px",
                padding: "20px 24px",
                borderRadius: "12px",
                background: "rgba(16,185,129,0.06)",
                border: "1px solid rgba(16,185,129,0.15)",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "#6ee7b7",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                Mandate
              </span>
              {minEdge && (
                <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.75)" }}>
                  min edge {(parseFloat(minEdge) * 100).toFixed(0)}%
                </span>
              )}
              {maxAlloc && (
                <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.75)" }}>
                  max alloc {(parseFloat(maxAlloc) * 100).toFixed(1)}%
                </span>
              )}
              {maxLoss && (
                <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.75)" }}>
                  loss limit {(parseFloat(maxLoss) * 100).toFixed(0)}%
                </span>
              )}
              {simRuns && (
                <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.75)" }}>
                  {parseInt(simRuns).toLocaleString()} paths
                </span>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: "24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>
              Public · verifiable on-chain
            </span>
            <span style={{ fontSize: "18px", color: "#6ee7b7", fontWeight: 500 }}>
              View track record →
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
/**
 * OG card for weather-based pages (existing functionality)
 */
function renderWeatherOG(searchParams) {
  const title = searchParams.get("title");
  const temp = searchParams.get("temp");
  const condition = searchParams.get("condition");
  const location = searchParams.get("location");

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
        }}
      >
        <div style={{ fontSize: "32px", opacity: 0.6, marginBottom: "20px" }}>
          fourcast 🌤️
        </div>
        {title ? (
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 300,
              textAlign: "center",
              maxWidth: "1000px",
              lineHeight: 1.2,
            }}
          >
            {title.substring(0, 80)}
          </h1>
        ) : (
          <>
            <h1 style={{ fontSize: "80px", fontWeight: 300 }}>{location}</h1>
            <h2 style={{ fontSize: "120px", fontWeight: 200 }}>{temp}°</h2>
            <p style={{ fontSize: "40px", opacity: 0.7 }}>{condition}</p>
          </>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

/**
 * OG card for prediction signals
 * Renders market title, confidence, edge, author, and Fourcast branding
 */
function renderSignalOG(searchParams) {
  const title = searchParams.get("title") || "Prediction Signal";
  const confidence = (searchParams.get("confidence") || "LOW").toUpperCase();
  const edge = searchParams.get("edge");
  const probability = searchParams.get("probability");
  const author = searchParams.get("author") || "";
  const venue = searchParams.get("venue") || "";

  // Confidence colors
  const confidenceColors = {
    HIGH: { bg: "#065f46", text: "#6ee7b7", border: "#10b981" },
    MEDIUM: { bg: "#78350f", text: "#fcd34d", border: "#f59e0b" },
    LOW: { bg: "#451a03", text: "#fb923c", border: "#f97316" },
    DEFAULT: { bg: "#1e293b", text: "#94a3b8", border: "#475569" },
  };
  const cc = confidenceColors[confidence] || confidenceColors.DEFAULT;

  // Edge display
  const edgeValue = edge ? parseFloat(edge) : null;
  const edgeColor = edgeValue !== null && edgeValue > 0 ? "#34d399" : edgeValue !== null && edgeValue < 0 ? "#f87171" : "#94a3b8";
  const edgeLabel = edgeValue !== null ? `${edgeValue > 0 ? "+" : ""}${(edgeValue * 100).toFixed(1)}%` : null;

  // Probability display
  const probValue = probability ? parseFloat(probability) : null;

  // Author display
  const authorDisplay = author
    ? `${author.substring(0, 6)}...${author.substring(author.length - 4)}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#080a0d",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid pattern background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Gradient accent line at top */}
        <div
          style={{
            height: "4px",
            width: "100%",
            background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
          }}
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "48px 56px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Header: Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "auto",
            }}
          >
            <span style={{ fontSize: "28px", opacity: 0.5 }}>fourcast</span>
            <span
              style={{
                fontSize: "14px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: "rgba(59, 130, 246, 0.15)",
                color: "#93c5fd",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              Signal
            </span>
            {venue && (
              <span
                style={{
                  fontSize: "14px",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.05)",
                  color: "#94a3b8",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {venue}
              </span>
            )}
          </div>

          {/* Market Title */}
          <div
            style={{
              fontSize: "40px",
              fontWeight: 300,
              lineHeight: 1.3,
              maxWidth: "900px",
              marginTop: "24px",
              marginBottom: "32px",
              color: "#f1f5f9",
            }}
          >
            {title.length > 100 ? title.substring(0, 100) + "..." : title}
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {/* Confidence Badge */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "16px 24px",
                borderRadius: "12px",
                background: cc.bg,
                border: `1px solid ${cc.border}`,
              }}
            >
              <span style={{ fontSize: "12px", color: cc.text, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Confidence
              </span>
              <span style={{ fontSize: "28px", fontWeight: 700, color: cc.text }}>
                {confidence}
              </span>
            </div>

            {/* Edge */}
            {edgeLabel && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: "12px", color: "#94a3b8", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Edge
                </span>
                <span style={{ fontSize: "28px", fontWeight: 700, color: edgeColor }}>
                  {edgeLabel}
                </span>
              </div>
            )}

            {/* Probability */}
            {probValue !== null && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: "12px", color: "#94a3b8", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  AI Probability
                </span>
                <span style={{ fontSize: "28px", fontWeight: 700, color: "#60a5fa" }}>
                  {(probValue * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Footer: Author + CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: "24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {authorDisplay && (
                <>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {author[0]?.toUpperCase() || "?"}
                  </div>
                  <span style={{ fontSize: "16px", color: "#94a3b8" }}>
                    {authorDisplay}
                  </span>
                </>
              )}
            </div>
            <span style={{ fontSize: "18px", color: "#60a5fa", fontWeight: 500 }}>
              Analyze on Fourcast →
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
