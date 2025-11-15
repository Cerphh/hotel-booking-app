import { fetchLiteHotelOffers } from "@/lib/liteapi";
import { fetchHotelOffers as fetchAmadeusOffers } from "@/lib/amadeus";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = parseFloat(searchParams.get("lat") || "0");
    const lon = parseFloat(searchParams.get("lon") || "0");
    const checkIn = searchParams.get("checkIn") || new Date().toISOString().split("T")[0];
    const checkOut = searchParams.get("checkOut") || new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // Try LiteAPI first
    const liteResults = await fetchLiteHotelOffers({
      lat,
      lon,
      checkIn,
      checkOut
    });

    if (liteResults.length > 0) {
      return Response.json(liteResults);
    }

    // Fallback to Amadeus
    const amadeusResults = await fetchAmadeusOffers({
      lat,
      lon,
      checkIn,
      checkOut
    });

    return Response.json(amadeusResults);

  } catch (err) {
    console.error(err);
    return Response.json({ error: "API error", details: err }, { status: 500 });
  }
}
