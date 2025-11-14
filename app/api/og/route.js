import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
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
