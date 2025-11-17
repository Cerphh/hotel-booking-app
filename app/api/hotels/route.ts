interface HotelData {
  roomType?: string;
  price?: number;
  currency?: string;
  amenities?: string[];
  availability?: number;
  provider: string;
}

// Lightweight internal fallback for hotel offers. This removes the hard
// dependency on the Amadeus client in development unless the user chooses
// to re-enable it. The function returns an empty array when no external
// provider is configured.
async function fetchHotelOffersFallback(_opts: { lat: number; lon: number; checkIn: string; checkOut: string }) {
  // If you want to enable a real provider later, replace this with a call
  // to your provider or re-introduce the `lib/amadeus.ts` implementation.
  return [] as Array<Partial<HotelData>>;
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

    const results = await fetchHotelOffersFallback({ lat, lon, checkIn, checkOut });

    if (results.length > 0) {
      const aggregatedOffer: HotelData = {
        roomType: results[0].roomType || "Standard Room",
        price: results[0].price,
        currency: results[0].currency || "PHP",
        amenities: Array.from(new Set(results.flatMap((o) => o.amenities || []))),
        availability: results.length,
        provider: "fallback",
      };

      return Response.json([aggregatedOffer]);
    }

    return Response.json([]);
  } catch (err) {
    console.error("Hotel API error:", err);
    return Response.json({ error: "API error", details: String(err) }, { status: 500 });
  }
}
