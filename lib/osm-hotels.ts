import axios from "axios";

export interface Hotel {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function searchHotelsByCity(city: string): Promise<Hotel[]> {
  try {
    const query = `
      [out:json][timeout:25];
      area["name"="${city}"]["boundary"="administrative"]->.searchArea;
      (
        node["tourism"="hotel"](area.searchArea);
        way["tourism"="hotel"](area.searchArea);
        relation["tourism"="hotel"](area.searchArea);
      );
      out center tags;
    `;

    const res = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20000 }
    );

    const elements = res.data.elements || [];

    return elements.map((el: any) => ({
      id: el.id.toString(),
      name: el.tags?.name || "Unnamed Hotel",
      location: city,
      latitude: el.lat || el.center?.lat || 0,
      longitude: el.lon || el.center?.lon || 0,
    }));
  } catch (err: any) {
    console.error(`⚠️ Failed to fetch hotels for ${city}:`, err.message || err);
    return [];
  }
}
