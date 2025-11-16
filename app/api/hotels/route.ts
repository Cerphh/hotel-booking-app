import { fetchHotelOffers as fetchAmadeusOffers } from "@/lib/amadeus";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = parseFloat(searchParams.get("lat") || "0");
    const lon = parseFloat(searchParams.get("lon") || "0");
    const checkIn = searchParams.get("checkIn") || new Date().toISOString().split("T")[0];
    const checkOut = searchParams.get("checkOut") || new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const amadeusResults = await fetchAmadeusOffers({ lat, lon, checkIn, checkOut });
    return Response.json(amadeusResults);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "API error", details: String(err) }, { status: 500 });
  }
}
