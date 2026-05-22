import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

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
