import axios from "axios";

export interface Hotel {
  province?: string;
  city?: string;
  barangay?: string;
  amenities?: boolean;
  roomType?: string;
  pricePerNight?: number;
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
}

// Metro Manila cities + CALABARZON provinces + other major cities
export const CITY_CENTERS: Record<string, { lat: number; lon: number }> = {
  // Metro Manila cities
  "Manila": { lat: 14.5995, lon: 120.9842 },
  "Quezon City": { lat: 14.6760, lon: 121.0437 },
  "Makati": { lat: 14.5547, lon: 121.0244 },
  "Pasig": { lat: 14.5764, lon: 121.0851 },
  "Taguig": { lat: 14.5176, lon: 121.0509 },
  "Mandaluyong": { lat: 14.5804, lon: 121.0359 },
  "Parañaque": { lat: 14.4958, lon: 120.9972 },
  "Las Piñas": { lat: 14.4546, lon: 120.9885 },
  "Muntinlupa": { lat: 14.4117, lon: 121.0467 },
  "Navotas": { lat: 14.4386, lon: 120.9371 },
  "Valenzuela": { lat: 14.7019, lon: 120.9863 },
  "Caloocan": { lat: 14.6760, lon: 120.9819 },
  "Malabon": { lat: 14.6588, lon: 120.9638 },
  "Marikina": { lat: 14.6500, lon: 121.1023 },
  "Pasay": { lat: 14.5347, lon: 121.0013 },

  // CALABARZON provinces
  "Cavite": { lat: 14.4743, lon: 120.8786 },
  "Laguna": { lat: 14.1797, lon: 121.2431 },
  "Batangas": { lat: 13.7569, lon: 121.0583 },
  "Rizal": { lat: 14.6101, lon: 121.1270 },
  "Quezon": { lat: 13.9356, lon: 121.6093 },

  // Other major cities
  "Cebu": { lat: 10.3157, lon: 123.8854 },
  "Davao del Sur": { lat: 6.7466, lon: 125.2050 },
  "Baguio": { lat: 16.4023, lon: 120.5960 },
  "Palawan": { lat: 9.8349, lon: 118.7380 },
};

const OVERPASS_URL = "https://lz4.overpass-api.de/api/interpreter";

// sleep helper
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// smaller radius for dense cities
const RADIUS_MAP: Record<string, number> = {
  "Manila": 1500,
  "Quezon City": 1500,
  "Makati": 1500,
  "Pasig": 1500,
  "Taguig": 1500,
  "Mandaluyong": 1500,
  "Parañaque": 1500,
  "Las Piñas": 1500,
  "Muntinlupa": 1500,
  "Navotas": 1500,
  "Valenzuela": 1500,
  "Caloocan": 1500,
  "Malabon": 1500,
  "Marikina": 1500,
  "Pasay": 1500,
};

// fetch helper with exponential backoff
async function fetchWithRetry(query: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(OVERPASS_URL, query, {
        headers: { "Content-Type": "text/plain" },
        timeout: 30000,
      });
      return res.data;
    } catch (err) {
      const waitTime = (i + 1) * 3000; // 3s, 6s, 9s
      console.warn(`Attempt ${i + 1} failed. Retrying in ${waitTime / 1000}s...`);
      await sleep(waitTime);
    }
  }
  console.error("All retries failed for query");
  return null;
}

// Fetch hotels for a given city/province
export async function searchHotelsByCity(
  city: string,
  radius: number = 5000
): Promise<Hotel[]> {
  const center = CITY_CENTERS[city];
  if (!center) return [];

  const radiusToUse = RADIUS_MAP[city] || radius;

  const query = `
    [out:json][timeout:25];
    node["tourism"~"hotel|motel|hostel|apartment"](around:${radiusToUse},${center.lat},${center.lon});
    out center;
  `;

  const data = (await fetchWithRetry(query))?.elements || [];

  const hotels: Hotel[] = data.map((el: any) => {
    const cityName = el.tags?.addr_city || el.tags?.addr_town || city;
    const province = el.tags?.addr_state || el.tags?.addr_region || "";
    return {
      id: el.id.toString(),
      name: el.tags?.name || "Unnamed Hotel",
      location: province ? `${cityName}, ${province}` : cityName,
      latitude: el.lat,
      longitude: el.lon,
    };
  });

  // Throttle next request to avoid API overload
  await sleep(3000);

  return hotels;
}
