import { NextResponse } from 'next/server';
import { fetchPOIsFromOverpass } from '../../../lib/ollama';

const OLLAMA_API = process.env.OLLAMA_API || process.env.NEXT_PUBLIC_OLLAMA_API || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || process.env.NEXT_PUBLIC_OLLAMA_MODEL || 'mistral';

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatWalkingTime(meters: number) {
  if (!Number.isFinite(meters)) return '';
  const minutes = Math.max(2, Math.round((meters / 1000) / 5 * 60));
  return `${minutes} min walk`;
}

function getUnsplashImageUrl(type: string, index: number): string {
  const queries: Record<string, string[]> = {
    restaurant: ['restaurant', 'food', 'cuisine', 'dining'],
    cafe: ['cafe', 'coffee', 'cozy cafe', 'coffee shop'],
    bar: ['bar', 'cocktails', 'pub', 'nightlife'],
    entertainment: ['nightlife', 'entertainment', 'karaoke', 'concert'],
    attraction: ['tourist attraction', 'landmark', 'park', 'museum'],
    park: ['park', 'garden', 'trees', 'green space'],
  };
  const typeQueries = queries[type] || ['travel'];
  const query = typeQueries[index % typeQueries.length];
  return `https://source.unsplash.com/400x300/?${encodeURIComponent(query)},batangas`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latParam = url.searchParams.get('lat');
    const lonParam = url.searchParams.get('lon');
    const hotelName = url.searchParams.get('hotelName') || '';

    if (!latParam || !lonParam) return NextResponse.json({ recommendations: [], error: 'Missing lat/lon' }, { status: 400 });
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ recommendations: [], error: 'Invalid lat/lon' }, { status: 400 });

    const pois = await fetchPOIsFromOverpass(lat, lon, 2000);

    // Build candidate lines for the model (can be empty)
    const candidateLines = (pois || []).slice(0, 40).map((p: any, i: number) => `${i + 1}. ${p.name} | ${p.type} | ${formatDistance(p.distanceMeters)} | ${p.lat},${p.lon} | ${p.address || ''}`).join('\n');

    const prompt = `You are a precise travel concierge. The guest is staying at "${hotelName}" at latitude ${lat}, longitude ${lon}. Below is a numbered list of real nearby places (gathered from OpenStreetMap) with their type, distance, and coordinates. From this list, select up to 8 places that a traveler would actually visit (prioritize restaurants, cafes, attractions, viewpoints, entertainment). Sort results by nearest first.

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

If you don't have exact coordinates for a candidate, prefer returning the name, a one-sentence description, and an approximate distance. Output only valid JSON. Do not include any extra commentary.`;

    const res = await fetch(`${OLLAMA_API}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, temperature: 0.2 }),
    });

    if (!res.ok) {
      // Fall back to simple POI-based recommendations
      const fallback = (pois || []).slice(0, 8).map((p: any, idx: number) => ({
        name: p.name,
        type: p.type || 'other',
        description: `Popular ${p.type} ${p.name}`,
        lat: p.lat,
        lon: p.lon,
        distance: formatDistance(p.distanceMeters),
        walkingTime: formatWalkingTime(p.distanceMeters),
        reason: `Close to ${hotelName}`,
        address: p.address,
        confidence: p.distanceMeters <= 2000 ? 'high' : 'low',
        imageUrl: getUnsplashImageUrl(p.type || 'other', idx),
      }));
      return NextResponse.json({ recommendations: fallback, error: `Ollama generate failed ${res.status}` }, { status: 200 });
    }

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
      // Build lookups by normalized name and by coords
      const poiMapByName = new Map<string, any>();
      const poiMapByCoords = new Map<string, any>();
      for (const p of (pois || [])) {
        const key = (p.name || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!poiMapByName.has(key)) poiMapByName.set(key, p);
        if (p.lat && p.lon) {
          const ck = `${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
          if (!poiMapByCoords.has(ck)) poiMapByCoords.set(ck, p);
        }
      }

      const recs = parsed.recommendations.slice(0, 8).map((r: any, idx: number) => {
        let latNum: number | undefined = undefined;
        let lonNum: number | undefined = undefined;
        if (r.lat !== undefined && r.lon !== undefined) {
          latNum = Number(r.lat);
          lonNum = Number(r.lon);
        } else if (r.coords) {
          const parts = String(r.coords).split(/[,\s]+/).map((s: string) => s.trim());
          if (parts.length >= 2) { latNum = Number(parts[0]); lonNum = Number(parts[1]); }
        }

        let matched: any = null;
        if (latNum && lonNum) {
          const ck = `${latNum.toFixed(5)}|${lonNum.toFixed(5)}`;
          matched = poiMapByCoords.get(ck);
        }
        if (!matched) {
          const norm = (r.name || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
          matched = poiMapByName.get(norm);
        }

        const distanceMeters = matched?.distanceMeters ?? (pois && pois[idx]?.distanceMeters) ?? 0;
        return {
          name: r.name,
          type: r.type || (matched?.type ?? 'other'),
          description: r.description || (matched ? `Popular ${matched.type} ${matched.name}` : ''),
          lat: latNum ?? matched?.lat,
          lon: lonNum ?? matched?.lon,
          distance: r.distance || formatDistance(distanceMeters),
          walkingTime: r.walkingTime || formatWalkingTime(distanceMeters),
          reason: r.reason || '',
          address: r.address || matched?.address,
          confidence: r.confidence || (distanceMeters <= 2000 ? 'high' : 'low'),
          imageUrl: getUnsplashImageUrl(r.type || matched?.type || 'other', idx),
        };
      });

      return NextResponse.json({ recommendations: recs }, { status: 200 });
    }

    // fallback to POIs-based suggestions
    const fallback = (pois || []).slice(0, 8).map((p: any, idx: number) => ({
      name: p.name,
      type: p.type || 'other',
      description: `Popular ${p.type} ${p.name}`,
      lat: p.lat,
      lon: p.lon,
      distance: formatDistance(p.distanceMeters),
      walkingTime: formatWalkingTime(p.distanceMeters),
      reason: `Close to ${hotelName}`,
      address: p.address,
      confidence: p.distanceMeters <= 2000 ? 'high' : 'low',
      imageUrl: getUnsplashImageUrl(p.type || 'other', idx),
    }));

    return NextResponse.json({ recommendations: fallback, error: 'Could not parse Ollama output' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ recommendations: [], error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
