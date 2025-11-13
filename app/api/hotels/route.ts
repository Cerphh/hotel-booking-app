import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!lat || !lon || !checkIn || !checkOut) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 1️⃣ Get Amadeus access token
    const tokenRes = await axios.post(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AMADEUS_CLIENT_ID!,
        client_secret: process.env.AMADEUS_CLIENT_SECRET!,
      })
    );
    const accessToken = tokenRes.data.access_token;

    // 2️⃣ Call Amadeus Hotel Search API
    const hotelRes = await axios.get(
      "https://test.api.amadeus.com/v2/shopping/hotel-offers",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          latitude: lat,
          longitude: lon,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          radius: 5, // search radius in km
          roomQuantity: 1,
          adults: 1,
        },
      }
    );

    return NextResponse.json(hotelRes.data.data || []);
  } catch (err: any) {
    console.error("API error:", err.response?.data || err.message || err);
    return NextResponse.json({ error: "Failed to fetch hotel offers" }, { status: 500 });
  }
}
