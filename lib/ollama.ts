/**
 * Ollama LLM Integration (clean)
 * - Fetch nearby POIs from OpenStreetMap Overpass
 * - Ask local Ollama to select + enrich up to 8 recommendations
 *
 * This module is client-safe (no Next.js server-only imports) so it can be
 * imported from client components. Configure Ollama via env vars:
 * - NEXT_PUBLIC_OLLAMA_API
 * - NEXT_PUBLIC_OLLAMA_MODEL
 */

export interface NearbyRecommendation {
  name: string;
  type: "restaurant" | "entertainment" | "attraction" | string;
  lat?: number;
  lon?: number;
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
const OLLAMA_API = (process.env.NEXT_PUBLIC_OLLAMA_API as string) || "http://localhost:11434";
const OLLAMA_MODEL = (process.env.NEXT_PUBLIC_OLLAMA_MODEL as string) || "mistral";

export async function getNearbyRecommendations(latitude: number, longitude: number, hotelName: string): Promise<OllamaRecommendations> {
  try {
    const pois = await fetchPOIsFromOverpass(latitude, longitude, 2000);
    if (!pois || pois.length === 0) {
      // No POIs found — return empty recommendations so UI shows no suggestions.
      return { recommendations: [], error: "No POIs found" };
    }

    // Build candidate lines including coordinates so the LLM can select by location
    const candidateLines = pois.slice(0, 40).map((p, i) => `${i + 1}. ${p.name} | ${p.type} | ${formatDistance(p.distanceMeters)} | ${p.lat},${p.lon} | ${p.address || ""}`).join("\n");
    const prompt = `You are a precise travel concierge. The guest is staying at "${hotelName}" at latitude ${latitude}, longitude ${longitude}. Below is a numbered list of real nearby places (gathered from OpenStreetMap) with their type, distance, and coordinates. From this list, select up to 8 places that a traveler would actually visit (prioritize restaurants, cafes, attractions, viewpoints, entertainment). Sort results by nearest first.

  CRITICAL: For each place, provide a UNIQUE, SPECIFIC description that describes what makes this particular place interesting or notable. DO NOT use generic phrases like "popular local attraction" or "well-known spot". Instead, describe what the place actually is (e.g., "Historic church with colonial architecture", "Scenic lakeside restaurant serving fresh seafood", "Viewpoint overlooking Taal Volcano").

  For each selected place include its latitude and longitude (use the coordinates from the candidate list if available). Return a single JSON object with a top-level "recommendations" array, each entry with these fields:
  - name (string)
  - type (string)
  - description (one unique, specific sentence describing this particular place)
  - distance (e.g. "350 m")
  - walkingTime (e.g. "6 min walk")
  - lat (number)
  - lon (number)
  - reason (short explanation why a traveler would visit)
  - address (optional)
  - confidence ("high" or "low")

  Candidates:
  ${candidateLines}

  Output only valid JSON. Do not include any extra commentary.`;

    const res = await fetch(`${OLLAMA_API}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, temperature: 0.2 }),
    });

    if (!res.ok) return { recommendations: buildRecommendationsFromPOIs(pois, hotelName), error: `Ollama error ${res.status}` };
    const data: any = await res.json();
    const text = data.response || data.text || JSON.stringify(data);

    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch (e) {
      const m = text.match(/"recommendations"\s*:\s*(\[[\s\S]*\])/i);
      if (m && m[1]) {
        try { parsed = { recommendations: JSON.parse(m[1]) }; } catch { parsed = null; }
      }
    }

    if (parsed && Array.isArray(parsed.recommendations)) {
      // Build lookups by normalized name and by rounded coordinates to attach coordinates
      const poiMapByName = new Map<string, any>();
      const poiMapByCoords = new Map<string, any>();
      for (const p of pois) {
        const key = (p.name || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!poiMapByName.has(key)) poiMapByName.set(key, p);
        if (p.lat && p.lon) {
          const ck = `${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
          if (!poiMapByCoords.has(ck)) poiMapByCoords.set(ck, p);
        }
      }

      const recs: NearbyRecommendation[] = parsed.recommendations.slice(0, 8).map((r: any, idx: number) => {
        // prefer lat/lon returned by LLM, else match by name or coords
        let latNum: number | undefined = undefined;
        let lonNum: number | undefined = undefined;
        if (r.lat !== undefined && r.lon !== undefined) {
          latNum = Number(r.lat);
          lonNum = Number(r.lon);
        } else if (r.coords) {
          const parts = String(r.coords).split(/[,\s]+/).map((s: string) => s.trim());
          if (parts.length >= 2) {
            latNum = Number(parts[0]);
            lonNum = Number(parts[1]);
          }
        }

        let matched: any = null;
        if (latNum && lonNum) {
          const ck = `${latNum.toFixed(5)}|${lonNum.toFixed(5)}`;
          matched = poiMapByCoords.get(ck);
        }

        if (!matched) {
          const norm = (r.name || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
          matched = poiMapByName.get(norm);
        }

        const distanceMeters = matched?.distanceMeters ?? pois[idx]?.distanceMeters ?? 0;
        return {
          name: r.name,
          type: r.type || (matched?.type ?? "other"),
          description: r.description || (matched ? `Popular ${matched.type} ${matched.name}` : ""),
          lat: latNum ?? matched?.lat,
          lon: lonNum ?? matched?.lon,
          distance: r.distance || formatDistance(distanceMeters),
          walkingTime: r.walkingTime || formatWalkingTime(distanceMeters),
          reason: r.reason || "",
          address: r.address || matched?.address,
          confidence: r.confidence || (distanceMeters <= 2000 ? "high" : "low"),
          imageUrl: getUnsplashImageUrl(r.type || matched?.type || "other", idx),
        } as NearbyRecommendation;
      });

      return { recommendations: recs };
    }

    // If we couldn't parse the LLM output, fall back to POIs if available, otherwise return empty
    const fallback = buildRecommendationsFromPOIs(pois, hotelName);
    if (fallback && fallback.length > 0) return { recommendations: fallback, error: "Could not parse LLM output" };
    return { recommendations: [], error: "Could not parse LLM output" };
  } catch (err) {
    // On any unexpected error, return an empty list and surface the error
    return { recommendations: [], error: (err as any)?.message || "Unknown error" };
  }
}

// Reuse helper implementations (same as earlier in file)
export async function fetchPOIsFromOverpass(lat: number, lon: number, radius = 2000) {
  try {
    // Target dining and attraction-relevant tags to reduce noise
    const q = `
      [out:json][timeout:25];
      (
        // Dining
        node(around:${radius},${lat},${lon})[amenity~"restaurant|cafe|bar|fast_food|pub|food_court"]["name"];
        way(around:${radius},${lat},${lon})[amenity~"restaurant|cafe|bar|fast_food|pub|food_court"]["name"];
        relation(around:${radius},${lat},${lon})[amenity~"restaurant|cafe|bar|fast_food|pub|food_court"]["name"];
        // Attractions / sightseeing
        node(around:${radius},${lat},${lon})[tourism~"attraction|museum|viewpoint|gallery|zoo"]["name"];
        way(around:${radius},${lat},${lon})[tourism~"attraction|museum|viewpoint|gallery|zoo"]["name"];
        relation(around:${radius},${lat},${lon})[tourism~"attraction|museum|viewpoint|gallery|zoo"]["name"];
        // Parks / leisure
        node(around:${radius},${lat},${lon})[leisure~"park|garden|playground"]["name"];
        way(around:${radius},${lat},${lon})[leisure~"park|garden|playground"]["name"];
        relation(around:${radius},${lat},${lon})[leisure~"park|garden|playground"]["name"];
      );
      out center;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(q)}` });
    if (!res.ok) return [];
    const j = await res.json();
    if (!Array.isArray(j.elements)) return [];

    // Map raw elements to POIs and filter for real POI-like tags
    const rawItems = j.elements
      .map((el: any) => {
        const name = el.tags?.name || el.tags?.["name:en"] || el.tags?.["name:local"];
        if (!name) return null;
        const latEl = el.lat ?? el.center?.lat;
        const lonEl = el.lon ?? el.center?.lon;
        if (!latEl || !lonEl) return null;
        const tags = el.tags || {};
        // Require at least one meaningful tag to avoid returning repeated hotel entries or unnamed nodes
        const meaningful = tags.amenity || tags.tourism || tags.shop || tags.leisure || tags.historic || tags.natural;
        if (!meaningful) return null;
        const type = mapOsmTagsToType(tags);
        const distanceMeters = haversineDistanceMeters(lat, lon, parseFloat(latEl), parseFloat(lonEl));
        const address = buildAddressFromTags(tags);
        return { name: name.trim(), type, lat: parseFloat(latEl), lon: parseFloat(lonEl), distanceMeters, address, tags };
      })
      .filter(Boolean) as any[];

    // Deduplicate by normalized name + rounded coordinates
    const keyMap = new Map<string, any>();
    for (const it of rawItems) {
      const key = `${it.name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${it.lat.toFixed(5)}_${it.lon.toFixed(5)}`;
      if (!keyMap.has(key)) keyMap.set(key, it);
    }

    const items = Array.from(keyMap.values()).sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
    return items;
  } catch { return []; }
}

function mapOsmTagsToType(tags: Record<string, any>) {
  if (!tags) return "other";
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food" || tags.cuisine) return "restaurant";
  if (tags.amenity === "cafe" || (tags.cuisine && String(tags.cuisine).toLowerCase().includes("coffee"))) return "cafe";
  if (tags.amenity === "bar" || tags.amenity === "pub") return "bar";
  if (tags.tourism === "attraction" || tags.tourism === "museum" || tags.tourism === "viewpoint" || tags.tourism === "gallery" || tags.tourism === "zoo") return "attraction";
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "playground") return "park";
  if (tags.entertainment || tags.nightclub) return "entertainment";
  return "other";
}

function buildAddressFromTags(tags: Record<string, any>) {
  if (!tags) return undefined;
  const parts: string[] = [];
  if (tags["addr:housename"]) parts.push(tags["addr:housename"]);
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  if (parts.length === 0) return undefined;
  return parts.join(", ");
}

function buildRecommendationsFromPOIs(pois: any[], hotelName?: string) {
  return pois.slice(0, 8).map((p: any, idx: number) => ({
    name: p.name,
    type: p.type || "other",
    description: `Popular ${p.type} ${p.name}`,
    lat: p.lat,
    lon: p.lon,
    distance: formatDistance(p.distanceMeters),
    walkingTime: formatWalkingTime(p.distanceMeters),
    reason: `Close to ${hotelName}`,
    address: p.address,
    confidence: p.distanceMeters <= 2000 ? "high" : "low",
    imageUrl: getUnsplashImageUrl(p.type || "other", idx),
  } as NearbyRecommendation));
}

function getUnsplashImageUrl(type: string, index: number): string {
  const queries: Record<string, string[]> = {
    restaurant: ["restaurant", "food", "cuisine", "dining"],
    cafe: ["cafe", "coffee", "cozy cafe", "coffee shop"],
    bar: ["bar", "cocktails", "pub", "nightlife"],
    entertainment: ["nightlife", "entertainment", "karaoke", "concert"],
    attraction: ["tourist attraction", "landmark", "park", "museum"],
    park: ["park", "garden", "trees", "green space"],
  };
  const typeQueries = queries[type] || ["travel"];
  const query = typeQueries[index % typeQueries.length];
  return `https://source.unsplash.com/400x300/?${encodeURIComponent(query)},batangas`;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseDistanceMeters(distanceStr?: string | null) {
  if (!distanceStr) return null;
  try {
    const s = distanceStr.trim();
    if (s.endsWith("m")) return parseFloat(s.replace(/[^0-9.]/g, ""));
    if (s.endsWith("km")) return parseFloat(s.replace(/[^0-9.]/g, "")) * 1000;
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatWalkingTime(meters: number) {
  if (!Number.isFinite(meters)) return "";
  const minutes = Math.max(2, Math.round((meters / 1000) / 5 * 60));
  return `${minutes} min walk`;
}

// Mock fallback removed per user request — only return real POIs or empty list.
