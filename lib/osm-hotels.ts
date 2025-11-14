import axios from "axios";
import liteApi from "liteapi-node-sdk";

export interface Hotel {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  price?: number;
  currency?: string;
  roomType?: string;
  amenities?: string[];
  availability?: number;
  imageUrl?: string;
  address?: string;
}

// LiteAPI client
const liteClient = liteApi(process.env.LITEAPI_KEY!);

export const CITY_CENTERS: Record<string, { lat: number; lon: number }> = {
  Batangas: { lat: 13.7569, lon: 121.0583 },
};

const OVERPASS_URL = "https://lz4.overpass-api.de/api/interpreter";

async function fetchWithRetry(query: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(OVERPASS_URL, query, {
        headers: { "Content-Type": "text/plain" },
        timeout: 30000,
      });
      return res.data;
    } catch (err) {
      await new Promise((r) => setTimeout(r, (i + 1) * 3000));
    }
  }
  return null;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    );
    const addr = res.data.address;
    return [
      addr.suburb || addr.neighbourhood || addr.village || addr.hamlet,
      addr.city || addr.town || addr.municipality || addr.village,
      "Batangas",
    ]
      .filter(Boolean)
      .join(", ");
  } catch {
    return "Batangas, Philippines";
  }
}

export async function searchHotelsByCity(city: string): Promise<Hotel[]> {
  const center = CITY_CENTERS[city];
  if (!center) return [];

  const south = 13.5;
  const west = 120.7;
  const north = 14.1;
  const east = 121.2;

  const osmQuery = `
    [out:json][timeout:60];
    node["tourism"~"hotel|motel|hostel|apartment"](${south},${west},${north},${east});
    out center;
  `;

  const osmData = (await fetchWithRetry(osmQuery))?.elements || [];

  // Only slice to 300 to avoid overload
  const hotels = await Promise.all(
    osmData.slice(0, 300).map(async (el: any) => {
      if (!el.lat || !el.lon) return null;

      const exactAddress = await reverseGeocode(el.lat, el.lon);

      const hotel: Hotel = {
        id: el.id.toString(),
        name: el.tags?.name || "Unnamed Hotel",
        location: el.tags?.addr_city || "Batangas, Philippines",
        latitude: el.lat,
        longitude: el.lon,
        address: exactAddress,
        imageUrl: `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(el.tags?.name || "hotel")}`,
      };

      // Fetch LiteAPI offers in parallel but safely
      try {
        const liteOffers = await liteClient.getFullRates({
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          checkin: new Date().toISOString().split("T")[0],
          checkout: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          limit: 1,
          currency: "PHP",
        });

        const data = liteOffers?.data;
        if (data && Array.isArray(data) && data.length > 0) {
          const best = data[0];
          hotel.price = best?.price?.amount ?? undefined;
          hotel.currency = best?.price?.currency ?? "PHP";
          hotel.roomType = best?.room_type ?? undefined;
          hotel.amenities = Array.isArray(best?.amenities) ? best.amenities : [];
          hotel.availability = typeof best?.rooms_available === "number" ? best.rooms_available : undefined;
          hotel.imageUrl = best?.images?.[0] ?? hotel.imageUrl;
        }
      } catch {}

      return hotel;
    })
  );

  return hotels.filter(Boolean) as Hotel[];
}
