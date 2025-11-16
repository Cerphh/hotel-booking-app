export interface HotelRoomOffer {
  roomType?: string;
  price?: number;
  currency?: string;
  amenities?: string[];
  provider?: string;
}

interface FetchHotelOffersParams {
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
}

async function getAmadeusToken(): Promise<string | null> {
  const clientId = process.env.AMADEUS_CLIENT_ID || process.env.AMADEUS_API_KEY;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET || process.env.AMADEUS_API_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("Amadeus credentials missing (AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET)");
    return null;
  }

  try {
    const tokenRes = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.warn("Amadeus token request failed", tokenRes.status);
      return null;
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token || null;
  } catch (err) {
    console.error("Failed to obtain Amadeus token:", err);
    return null;
  }
}

export async function fetchHotelOffers({ lat, lon, checkIn, checkOut }: FetchHotelOffersParams): Promise<HotelRoomOffer[]> {
  try {
    const token = await getAmadeusToken();
    if (!token) return [];

    // Build query parameters. Amadeus Hotel Offers API supports latitude/longitude, radius, checkInDate, checkOutDate
    const params = new URLSearchParams();
    params.set("latitude", String(lat));
    params.set("longitude", String(lon));
    params.set("radius", "5"); // km
    params.set("checkInDate", checkIn);
    params.set("checkOutDate", checkOut);
    params.set("bestRateOnly", "true");
    params.set("currency", "USD");

    const url = `https://test.api.amadeus.com/v2/shopping/hotel-offers?${params.toString()}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn("Amadeus hotel-offers request failed", res.status);
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.data)) return [];

    // Normalize offers: each item in data.data represents a hotel with `offers` array
    const offers: HotelRoomOffer[] = [];
    for (const hotel of data.data) {
      if (!hotel.offers || !Array.isArray(hotel.offers)) continue;
      for (const offer of hotel.offers) {
        const roomType = offer.room?.type || offer.room?.description || offer.room?.name || undefined;
        const priceTotal = offer.price?.total ?? offer.price?.value ?? undefined;
        const currency = offer.price?.currency || offer.price?.currencyCode || undefined;

        // collect amenities if present in room or in additional data
        const amenities: string[] = [];
        if (Array.isArray(offer.room?.amenities)) amenities.push(...offer.room.amenities.map(String));
        if (Array.isArray(offer.amenities)) amenities.push(...offer.amenities.map(String));

        offers.push({
          roomType: roomType,
          price: priceTotal !== undefined ? Number(priceTotal) : undefined,
          currency: currency || "USD",
          amenities: amenities.filter(Boolean),
          provider: "amadeus",
        });
      }
    }

    return offers;
  } catch (err) {
    console.error("fetchHotelOffers (Amadeus) error:", err);
    return [];
  }
}
