/**
 * Ollama LLM Integration
 * Fetches nearby recommendations (restaurants, entertainment, attractions)
 * Requires Ollama running locally (default: http://localhost:11434)
 */

export interface NearbyRecommendation {
  name: string;
  type: "restaurant" | "entertainment" | "attraction" | string;
  description: string;
  distance: string;
  walkingTime?: string;
  reason?: string;
  address?: string;
  confidence?: string;
  imageUrl?: string;
}

export interface OllamaRecommendations {
  recommendations: NearbyRecommendation[];
  error?: string;
}

const OLLAMA_API = process.env.NEXT_PUBLIC_OLLAMA_API || "http://localhost:11434";
const OLLAMA_MODEL = process.env.NEXT_PUBLIC_OLLAMA_MODEL || "mistral";

export async function getNearbyRecommendations(
  latitude: number,
  longitude: number,
  hotelName: string
): Promise<OllamaRecommendations> {
  try {
    const prompt = `You are a factual travel assistant. Using the coordinates (${latitude}, ${longitude}) and the hotel name "${hotelName}", return up to 8 nearby places (prioritize restaurants, attractions, entertainment, cafes, viewpoints) within 3 km, sorted by proximity. Use only real, verifiable places when possible. If you are unsure about a place, mark its confidence as "low".

Return a single JSON object with a top-level "recommendations" array. Each recommendation must include: name, type (one of: restaurant, entertainment, attraction, cafe, viewpoint, other), description (1 short sentence), distance (use meters or km), walkingTime (estimate like "10 min walk"), reason (one short phrase why visit), and optionally address and any external id/source. Example structure (follow exactly, do not add extra text):

{
  "recommendations": [
    {"name":"Example Place","type":"attraction","description":"Short 1-sentence description.","distance":"0.5 km","walkingTime":"6 min","reason":"Scenic view of the bay","address":"123 Main St","confidence":"high"}
  ]
}

Keep descriptions concise and truthful. Do not include commentary or preface — output only the JSON object.`;

    const response = await fetch(`${OLLAMA_API}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error(`Ollama API error: ${response.status}`);
      return {
        recommendations: getMockRecommendations(),
        error: "Ollama service unavailable, using mock data",
      };
    }

    const data = await response.json();
    const responseText = data.response || data.text || JSON.stringify(data);

    // Try to extract a JSON object that contains a "recommendations" key
    const objMatch = responseText.match(/"recommendations"\s*:\s*(\[[\s\S]*\])/i);
    let recommendations: NearbyRecommendation[] | null = null;

    if (objMatch && objMatch[1]) {
      try {
        recommendations = JSON.parse(objMatch[1]) as NearbyRecommendation[];
      } catch (err) {
        console.warn("Failed to parse recommendations array, falling back to full JSON parse", err);
      }
    }

    // As a fallback, try to parse a top-level object with recommendations
    if (!recommendations) {
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && Array.isArray(parsed.recommendations)) {
          recommendations = parsed.recommendations as NearbyRecommendation[];
        }
      } catch (err) {
        console.warn("Could not parse JSON from Ollama response", err);
      }
    }

    if (!recommendations) {
      console.warn("Could not parse recommendations from Ollama response");
      return {
        recommendations: getMockRecommendations(),
        error: "Could not parse recommendations",
      };
    }

    // Verify and enrich recommendations with geocoding (Nominatim) to improve accuracy
    const verified = await Promise.all(
      recommendations.map(async (rec, idx) => {
        try {
          const geocoded = await geocodePlace(rec.name, latitude, longitude, rec.address || "");
          const imageUrl = getUnsplashImageUrl(rec.type, idx);
          return {
            ...rec,
            // prefer geocoded distance/address if available
            distance: geocoded?.distanceStr || rec.distance,
            walkingTime: geocoded?.walkingTime || rec.walkingTime,
            address: geocoded?.address || rec.address,
            confidence: geocoded?.confidence || (rec as any).confidence || "low",
            imageUrl,
          } as NearbyRecommendation & { confidence?: string };
        } catch (e) {
          return {
            ...rec,
            imageUrl: getUnsplashImageUrl(rec.type, idx),
            confidence: (rec as any).confidence || "low",
          } as NearbyRecommendation & { confidence?: string };
        }
      })
    );

    // Filter or sort: keep only places within 3 km, but if none are within range, return original list
    const within3km = verified.filter((r) => {
      const d = parseDistanceMeters(r.distance || "");
      return d !== null && d <= 3000;
    });

    const finalRecommendations = within3km.length > 0 ? within3km : verified;

    return { recommendations: finalRecommendations as NearbyRecommendation[] };
  } catch (error) {
    console.error("Error fetching Ollama recommendations:", error);
    return {
      recommendations: getMockRecommendations(),
      error: "Failed to fetch recommendations",
    };
  }
}

function getUnsplashImageUrl(type: string, index: number): string {
  const queries: Record<string, string[]> = {
    restaurant: ["restaurant", "food", "cuisine", "dining"],
    entertainment: ["nightlife", "entertainment", "karaoke", "bar"],
    attraction: ["tourist attraction", "landmark", "park", "museum"],
  };

  const typeQueries = queries[type] || ["travel"];
  const query = typeQueries[index % typeQueries.length];
  return `https://source.unsplash.com/400x300/?${encodeURIComponent(query)},batangas`;
}

async function geocodePlace(name: string, hotelLat: number, hotelLon: number, hintAddress = "") {
  try {
    const q = encodeURIComponent(`${name} ${hintAddress}`.trim());
    // Nominatim public instance - for production consider your own instance or a paid geocoding API
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "HotBook/1.0 (hotbook@example.com)" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!Array.isArray(j) || j.length === 0) return null;
    const place = j[0];
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

    const meters = haversineDistanceMeters(hotelLat, hotelLon, lat, lon);
    const distanceStr = meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
    const walkingMinutes = Math.max(1, Math.round((meters / 1000) / 5 * 60)); // 5 km/h walking speed
    const walkingTime = `${walkingMinutes} min walk`;
    const address = place.display_name || hintAddress || undefined;
    const confidence = meters <= 3000 ? "high" : "low";
    return { lat, lon, distance: meters, distanceStr, walkingTime, address, confidence };
  } catch (err) {
    return null;
  }
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseDistanceMeters(distanceStr?: string | null) {
  if (!distanceStr) return null;
  try {
    const s = distanceStr.trim();
    if (s.endsWith("m")) return parseFloat(s.replace(/[^0-9.]/g, ""));
    if (s.endsWith("km")) return parseFloat(s.replace(/[^0-9.]/g, "")) * 1000;
    // fallback: try number
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

function getMockRecommendations(): NearbyRecommendation[] {
  return [
    {
      name: "Bulalo Turo Turo",
      type: "restaurant",
      description: "Famous local restaurant serving traditional Batangas bulalo (beef marrow soup) and Filipino dishes.",
      distance: "0.8 km",
      imageUrl: "https://source.unsplash.com/400x300/?restaurant,food",
    },
    {
      name: "Bauan Fishing Port & Market",
      type: "restaurant",
      description: "Fresh seafood market and restaurant with local delicacies and ocean views.",
      distance: "1.5 km",
      imageUrl: "https://source.unsplash.com/400x300/?seafood,market",
    },
    {
      name: "Mabini Night Market",
      type: "entertainment",
      description: "Vibrant night market with local food vendors, street performances, and entertainment.",
      distance: "1.2 km",
      imageUrl: "https://source.unsplash.com/400x300/?nightlife,entertainment",
    },
    {
      name: "Karaoke Nights Bar",
      type: "entertainment",
      description: "Popular karaoke bar with local Filipino bands and great atmosphere for evening fun.",
      distance: "0.6 km",
      imageUrl: "https://source.unsplash.com/400x300/?karaoke,bar",
    },
    {
      name: "Taal Volcano National Park",
      type: "attraction",
      description: "UNESCO World Heritage site with stunning volcanic landscape and hiking trails. One of the most famous landmarks in the region.",
      distance: "2.0 km",
      imageUrl: "https://source.unsplash.com/400x300/?volcano,nature",
    },
    {
      name: "Liliw Heritage Town",
      type: "attraction",
      description: "Historic town known for its traditional Spanish colonial architecture and local handicrafts.",
      distance: "1.8 km",
      imageUrl: "https://source.unsplash.com/400x300/?historic,architecture",
    },
  ];
}
