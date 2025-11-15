import axios from "axios";
import { fetchHotelOffers as getAmadeusOffers, HotelRoomOffer } from "./amadeus";

const liteApiClient = axios.create({
  baseURL: "https://api.liteapi.travel",
  timeout: 5000,
});

interface LiteApiParams {
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
}

export async function fetchLiteHotelOffers(params: LiteApiParams): Promise<HotelRoomOffer[]> {
  try {
    const resp = await liteApiClient.get("/hotels", { params });

    if (!resp.data?.hotels) return [];

    return resp.data.hotels.map((h: any): HotelRoomOffer => ({
      roomType: h.roomType || "Unknown",
      price: h.price || undefined,
      currency: h.currency || "USD",
      amenities: h.amenities || [],
    }));
  } catch (err) {
    console.error("LiteAPI error", err);

    // fallback to Amadeus if LiteAPI fails
    return await getAmadeusOffers(params);
  }
}
