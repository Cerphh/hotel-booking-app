import axios from "axios";

if (!process.env.LITEAPI_URL || !process.env.LITEAPI_KEY) {
  throw new Error("LITEAPI_URL and LITEAPI_KEY must be set in .env");
}

const liteApiClient = axios.create({
  baseURL: process.env.LITEAPI_URL,
  headers: {
    Authorization: `Bearer ${process.env.LITEAPI_KEY}`,
    "Content-Type": "application/json",
  },
});

export interface LiteHotelOffer {
  price?: number;
  currency?: string;
  roomType?: string;
  amenities: string[];
  availability: number;
  imageUrl: string;
  address: string;
}

export async function fetchLiteHotelOffers(params: {
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
}): Promise<LiteHotelOffer[]> {
  try {
    // ✅ Ensure baseURL is valid
    const resp = await liteApiClient.get("/hotels", { params });

    if (!resp.data || !Array.isArray(resp.data.hotels)) {
      console.warn("LiteAPI returned no data or invalid format for", params);
      return [];
    }

    return resp.data.hotels.map((h: any) => ({
      price: h?.price?.amount ?? undefined,
      currency: h?.price?.currency ?? "PHP",
      roomType: h?.room_type ?? "N/A",
      amenities: Array.isArray(h?.amenities) ? h.amenities : [],
      availability: typeof h?.availability_count === "number" ? h.availability_count : 0,
      imageUrl: h?.image ?? "https://via.placeholder.com/400x300",
      address: h?.address ?? "Batangas, Philippines",
    }));
  } catch (error) {
    console.error("LiteAPI fetch error:", error);
    return [];
  }
}
