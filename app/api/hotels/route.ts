import { fetchHotelOffers as fetchAmadeusOffers } from "@/lib/amadeus";

interface HotelData {
  roomType?: string;
  price?: number;
  currency?: string;
  amenities?: string[];
  availability?: number;
  provider: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = parseFloat(searchParams.get("lat") || "0");
    const lon = parseFloat(searchParams.get("lon") || "0");
    const checkIn = searchParams.get("checkIn") || new Date().toISOString().split("T")[0];
    const checkOut = searchParams.get("checkOut") || new Date(Date.now() + 86400000).toISOString().split("T")[0];

    if (!lat || !lon) {
      return Response.json(
        { error: "Missing latitude or longitude" },
        { status: 400 }
      );
    }

    const amadeusResults = await fetchAmadeusOffers({ lat, lon, checkIn, checkOut });
    
    if (amadeusResults.length > 0) {
      const aggregatedOffer: HotelData = {
        roomType: amadeusResults[0].roomType || "Standard Room",
        price: amadeusResults[0].price,
        currency: amadeusResults[0].currency || "PHP",
        amenities: Array.from(
          new Set(
            amadeusResults.flatMap((offer) => offer.amenities || [])
          )
        ),
        availability: amadeusResults.length,
        provider: "amadeus",
      };

      return Response.json([aggregatedOffer]);
    }

    return Response.json([]);
  } catch (err) {
    console.error("Hotel API error:", err);
    return Response.json(
      { error: "API error", details: String(err) },
      { status: 500 }
    );
  }
}
