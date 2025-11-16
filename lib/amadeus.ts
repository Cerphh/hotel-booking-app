export interface HotelRoomOffer {
  roomType?: string;
  price?: number;
  currency?: string;
  amenities?: string[];
  provider?: string;
  availability?: number;
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
      console.warn(`Amadeus token request failed: ${tokenRes.status} ${tokenRes.statusText}`);
      const errorText = await tokenRes.text();
      console.warn("Token error details:", errorText);
      return null;
    }

    const tokenData = await tokenRes.json();
    console.log("✓ Amadeus token obtained successfully");
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
    params.set("currency", "PHP");

    const url = `https://test.api.amadeus.com/v2/shopping/hotel-offers?${params.toString()}`;
    console.log(`Fetching Amadeus offers from: ${url}`);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn(`Amadeus hotel-offers request failed: ${res.status} ${res.statusText}`);
      const errorText = await res.text();
      console.warn("Response details:", errorText);
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.data)) {
      console.log("No hotel data returned from Amadeus");
      return [];
    }

    console.log(`Amadeus returned ${data.data.length} hotels`);

    // Normalize offers: each item in data.data represents a hotel with `offers` array
    const offers: HotelRoomOffer[] = [];
    for (const hotel of data.data) {
      if (!hotel.offers || !Array.isArray(hotel.offers)) continue;
      
      // Calculate availability from number of available offers
      const availability = hotel.offers.length;
      
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
          currency: currency || "PHP",
          amenities: amenities.filter(Boolean),
          provider: "amadeus",
          availability: availability,
        });
      }
    }

    return offers;
  } catch (err) {
    console.error("fetchHotelOffers (Amadeus) error:", err);
    return [];
  }
}
