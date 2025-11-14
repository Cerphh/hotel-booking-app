import { NextRequest, NextResponse } from "next/server";
import { searchHotelsByCity, OSMHotel } from "@/lib/osm-hotels";
import { LiteHotelOffer } from "@/lib/liteapi";

interface Hotel extends OSMHotel {
  offers?: LiteHotelOffer[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const lat = parseFloat(searchParams.get("lat") || "0");
  const lon = parseFloat(searchParams.get("lon") || "0");
  const checkIn = searchParams.get("checkIn") || "2025-11-14";
  const checkOut = searchParams.get("checkOut") || "2025-11-15";

  try {
    // Fetch OSM + LiteAPI enriched hotels
    const osmHotels: OSMHotel[] = await searchHotelsByCity("Batangas");

    const hotels: Hotel[] = osmHotels.map((h) => ({
      ...h,
      offers: h.offers ?? [],
    }));

    return NextResponse.json(hotels);
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
