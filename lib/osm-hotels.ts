// lib/osm-hotels.ts
import axios from "axios";

export interface Hotel {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location: string;
  address?: string;
  imageUrl?: string;
}

export const CITY_CENTERS: Record<string, { lat: number; lon: number }> = {
  Batangas: { lat: 13.7569, lon: 121.0583 },
};

const OVERPASS_URL = "https://lz4.overpass-api.de/api/interpreter";

async function fetchWithRetry(query: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(OVERPASS_URL, query, {
        headers: { "Content-Type": "text/plain" },
        timeout: 20000,
      });
      return res.data;
    } catch (err) {
      await new Promise((r) => setTimeout(r, (i + 1) * 2000));
    }
  }
  return null;
}

export async function searchHotelsByCity(city: string): Promise<Hotel[]> {
  const bbox = `(13.5,120.7,14.1,121.2)`;

  const query = `
    [out:json][timeout:40];
    node["tourism"~"hotel|motel|hostel|apartment"]${bbox};
    out center;
  `;

  const data = await fetchWithRetry(query);
  if (!data?.elements) return [];

  return data.elements.slice(0, 120).map((el: any) => ({
    id: String(el.id),
    name: el.tags?.name || "Unnamed Hotel",
    latitude: el.lat,
    longitude: el.lon,
    location: "Batangas",
    imageUrl: `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(
      el.tags?.name || "hotel"
    )}`,
  }));
}
