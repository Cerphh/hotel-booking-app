import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID!;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET!;
const AMADEUS_API_URL = "https://test.api.amadeus.com/v2/shopping/hotel-offers";

let token: string | null = null;
let tokenExpiry = 0;

async function authenticateAmadeus() {
  const now = Date.now();
  if (token && tokenExpiry > now) return token;

  const res = await axios.post(
    "https://test.api.amadeus.com/v1/security/oauth2/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AMADEUS_CLIENT_ID,
      client_secret: AMADEUS_CLIENT_SECRET,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  token = res.data.access_token;
  tokenExpiry = now + res.data.expires_in * 1000;
  return token;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");

  if (!lat || !lon || !checkIn || !checkOut) {
    return NextResponse.json({ error: "Missing query parameters" }, { status: 400 });
  }

  try {
    const accessToken = await authenticateAmadeus();

    const res = await axios.get(AMADEUS_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        latitude: lat,
        longitude: lon,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        radius: 5,
        roomQuantity: 1,
      },
    });

    return NextResponse.json(res.data.data || []);
  } catch (err) {
    console.error("Amadeus fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch hotel offers" }, { status: 500 });
  }
}
