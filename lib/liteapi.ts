// lib/liteapi.ts
export interface LiteAPIHotel {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  amenities?: string[];
  roomType?: string;
  availability?: number;
}

export async function fetchHotelsFromLiteAPI(
  lat: number,
  lon: number,
  checkIn: string,
  checkOut: string
): Promise<LiteAPIHotel[]> {
  const apiKey = process.env.LITEAPI_KEY;
  if (!apiKey) {
    console.warn("LiteAPI key not configured");
    return [];
  }

  try {
    const baseUrl = process.env.LITEAPI_BASE_URL || "https://api.liteapi.com";
    
    // LiteAPI search endpoint
    const url = `${baseUrl}/v1/search/hotels`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        checkIn,
        checkOut,
        currency: "PHP",
      }),
    });

    if (!response.ok) {
      console.warn("LiteAPI request failed", response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.hotels || !Array.isArray(data.hotels)) {
      return [];
    }

    return data.hotels.slice(0, 50).map((hotel: Record<string, unknown>) => ({
      id: (hotel.id as string) || String(hotel.hotelId),
      name: hotel.name as string,
      price: (hotel.price as Record<string, number>)?.amount,
      currency: ((hotel.price as Record<string, string>)?.currency || "PHP") as string,
      amenities: (hotel.amenities as string[]) || [],
      roomType: (hotel.roomType as string) || "Standard Room",
      availability: ((hotel.availableRooms as number) || (hotel.availability as number) || 1) as number,
    }));
  } catch (err) {
    console.error("LiteAPI error:", err);
    return [];
  }
}
