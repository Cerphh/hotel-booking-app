import { NextResponse } from 'next/server';
import { getNearbyRecommendations, fetchPOIsFromOverpass } from '@/lib/ollama';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo-16k';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const hotelName = url.searchParams.get('hotelName') || 'Your Hotel';

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing lat or lon query parameters' }, { status: 400 });
    }

    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return NextResponse.json({ error: 'Invalid lat or lon' }, { status: 400 });
    }

    let res = await getNearbyRecommendations(latNum, lonNum, hotelName);
    const includeDebug = url.searchParams.get('debug');
    // If debug requested, also fetch raw POIs from Overpass so caller can inspect source data
    let debugPois: any[] | undefined = undefined;
    if (includeDebug) {
      try {
        debugPois = await fetchPOIsFromOverpass(latNum, lonNum, 2000);
      } catch (e) {
        console.error('Failed fetching debug POIs', e);
      }
    }

    // If Ollama didn't return useful results and we have an OpenAI key, try OpenAI server-side
    if ((res.error || !res.recommendations || res.recommendations.length === 0) && OPENAI_KEY) {
      try {
        const pois = await fetchPOIsFromOverpass(latNum, lonNum, 2000);
        const candidateLines = pois.slice(0, 40).map((p, i) => `${i + 1}. ${p.name} | ${p.type} | ${p.lat},${p.lon} | ${formatDistanceForPrompt(p.distanceMeters)} | ${p.address || ''}`).join('\n');
        const prompt = `You are a precise travel concierge. The guest is staying at "${hotelName}" at latitude ${latNum}, longitude ${lonNum}. Below is a numbered list of real nearby places (gathered from OpenStreetMap) with their type, distance, and coordinates. From this list, select up to 8 places that a traveler would actually visit (prioritize restaurants, cafes, attractions, viewpoints, entertainment). Sort results by nearest first.

CRITICAL: For each place, provide a UNIQUE, SPECIFIC description that describes what makes this particular place interesting or notable. DO NOT use generic phrases like "popular local attraction" or "well-known spot". Instead, describe what the place actually is (e.g., "Historic church with colonial architecture", "Scenic lakeside restaurant serving fresh seafood", "Viewpoint overlooking Taal Volcano").

Candidates:
${candidateLines}

Return only valid JSON with a top-level "recommendations" array. Each recommendation must include: name,type,description (one unique, specific sentence),distance,walkingTime,lat,lon,reason,address,confidence.`;

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: prompt }], max_tokens: 1500 }),
        });

        if (aiRes.ok) {
          const j = await aiRes.json();
          const text = j?.choices?.[0]?.message?.content || JSON.stringify(j);
          let parsed = null;
          try { parsed = JSON.parse(text); } catch (e) {
            const m = text.match(/"recommendations"\s*:\s*(\[[\s\S]*\])/i);
            if (m && m[1]) {
              try { parsed = { recommendations: JSON.parse(m[1]) }; } catch { parsed = null; }
            }
          }

          if (parsed && Array.isArray(parsed.recommendations)) {
            res = { recommendations: parsed.recommendations };
          }
        }
      } catch (e) {
        // ignore and return original res
        console.error('OpenAI fallback failed', e);
      }
    }

    // Return recommendations and optional debug POIs + error information
    // If there are no recommendations, fetch POIs across Batangas province
    // and use entries at least 2km away as sample recommendations.
    if (!res || !res.recommendations || res.recommendations.length === 0) {
      try {
        const overpassQ = `
          [out:json][timeout:60];
          area["name"="Batangas"][admin_level="4"]->.searchArea;
          (
            node(area.searchArea)[amenity~"restaurant|cafe|bar|fast_food|pub|food_court"]["name"];
            way(area.searchArea)[amenity~"restaurant|cafe|bar|fast_food|pub|food_court"]["name"];
            relation(area.searchArea)[amenity~"restaurant|cafe|bar|fast_food|pub|food_court"]["name"];
            node(area.searchArea)[tourism~"attraction|museum|viewpoint|gallery|zoo"]["name"];
            way(area.searchArea)[tourism~"attraction|museum|viewpoint|gallery|zoo"]["name"];
            relation(area.searchArea)[tourism~"attraction|museum|viewpoint|gallery|zoo"]["name"];
            node(area.searchArea)[leisure~"park|garden|playground"]["name"];
            way(area.searchArea)[leisure~"park|garden|playground"]["name"];
            relation(area.searchArea)[leisure~"park|garden|playground"]["name"];
          );
          out center;`;

        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQ)}`,
        });

        if (overpassRes.ok) {
          const j = await overpassRes.json();
          const elements = Array.isArray(j.elements) ? j.elements : [];

          // Map raw elements to POIs with lat/lon and distance to hotel
          const rawItems = elements
            .map((el: any) => {
              const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.['name:local'];
              if (!name) return null;
              const latEl = el.lat ?? el.center?.lat;
              const lonEl = el.lon ?? el.center?.lon;
              if (!latEl || !lonEl) return null;
              const tags = el.tags || {};
              const type = (() => {
                if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.cuisine) return 'restaurant';
                if (tags.amenity === 'cafe' || (tags.cuisine && String(tags.cuisine).toLowerCase().includes('coffee'))) return 'cafe';
                if (tags.amenity === 'bar' || tags.amenity === 'pub') return 'bar';
                if (tags.tourism === 'attraction' || tags.tourism === 'museum' || tags.tourism === 'viewpoint' || tags.tourism === 'gallery' || tags.tourism === 'zoo') return 'attraction';
                if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'playground') return 'park';
                return 'other';
              })();

              const distanceMeters = haversineDistanceMeters(latNum, lonNum, parseFloat(latEl), parseFloat(lonEl));
              const addressParts: string[] = [];
              if (tags['addr:street']) addressParts.push(tags['addr:street']);
              if (tags['addr:city']) addressParts.push(tags['addr:city']);
              const address = addressParts.length ? addressParts.join(', ') : undefined;
                // include cuisine/tourism tags where available for richer descriptions
                const cuisine = tags.cuisine || tags['cuisine:primary'] || undefined;
                return { name: name.trim(), type, lat: parseFloat(latEl), lon: parseFloat(lonEl), distanceMeters, address, cuisine, rawTags: tags };
            })
            .filter(Boolean) as any[];

            // Remove any undesirable or noisy POI names (blacklist)
            const blacklist = [
              /omg\s*olvida/i,
              /myras?\s*grill/i,
              /trattoria\s*altrov(?:e|é)?/i,
              /casa\s*azul\s*caf(?:e|é)?/i,
            ];

            const cleanedItems = rawItems.filter((p) => {
              if (!p || !p.name) return false;
              return !blacklist.some((rx) => rx.test(p.name));
            });

            // Filter for items within 5000m (<= 5km) from the hotel, sort by distance ascending
            const nearItems = cleanedItems.filter((p) => Number.isFinite(p.distanceMeters) && p.distanceMeters <= 5000).sort((a, b) => a.distanceMeters - b.distanceMeters);

          if (nearItems.length > 0) {
            // Build a unique, specific description for each POI based on its characteristics
            const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
            
            // Track which descriptions we've used to avoid repetition
            const usedDescriptions = new Set<string>();
            
            const briefDescriptionFor = (p: any, idx: number) => {
              const t = String(p.type || '').toLowerCase();
              const cuisineRaw = p.cuisine ? String(p.cuisine) : '';
              const cuisine = cuisineRaw.split(';')[0]?.trim();
              const name = p.name || '';
              const tags = p.rawTags || {};
              
              // Generate unique descriptions based on available metadata
              if (t === 'restaurant') {
                const options: string[] = [];
                
                if (cuisine && cuisine.toLowerCase() !== 'regional') {
                  options.push(`${capitalize(cuisine)} restaurant offering authentic local flavors`);
                }
                if (name.toLowerCase().includes('seafood')) options.push('Fresh seafood restaurant with local specialties');
                if (name.toLowerCase().includes('grill')) options.push('Grilled specialties and local cuisine');
                if (name.toLowerCase().includes('buffet')) options.push('All-you-can-eat buffet with diverse menu');
                if (name.toLowerCase().includes('haus')) options.push('Traditional eatery with home-style cooking');
                if (name.toLowerCase().includes('lomi')) options.push('Specialty noodle house with authentic lomi');
                
                // Add varied fallback options based on index
                const fallbacks = [
                  'Family-friendly restaurant with local favorites',
                  'Casual dining spot with regional specialties',
                  'Restaurant featuring traditional Filipino cuisine',
                  'Popular eatery known for authentic local dishes',
                  'Dining establishment with homemade specialties',
                  'Local restaurant with diverse menu options',
                  'Established dining venue serving classic recipes',
                  'Neighborhood restaurant with signature dishes',
                ];
                
                options.push(...fallbacks);
                
                // Find first unused description
                for (const desc of options) {
                  if (!usedDescriptions.has(desc)) {
                    usedDescriptions.add(desc);
                    return desc;
                  }
                }
                
                // If all used, return index-based fallback
                return fallbacks[idx % fallbacks.length];
              }
              if (t === 'cafe') {
                const options = [];
                if (name.toLowerCase().includes('coffee')) options.push('Artisan coffee shop with cozy ambiance');
                if (cuisine && cuisine.toLowerCase().includes('bakery')) options.push('Cafe and bakery with fresh pastries');
                
                options.push(
                  'Casual cafe perfect for coffee and light meals',
                  'Cozy coffeehouse with local pastries',
                  'Relaxing cafe with specialty drinks',
                  'Charming spot for breakfast and brunch',
                );
                
                for (const desc of options) {
                  if (!usedDescriptions.has(desc)) {
                    usedDescriptions.add(desc);
                    return desc;
                  }
                }
                return options[idx % options.length];
              }
              if (t === 'bar' || t === 'pub') {
                if (name.toLowerCase().includes('karaoke')) return 'Lively bar with karaoke entertainment';
                const options = ['Local bar and social gathering spot', 'Casual pub with refreshing drinks', 'Neighborhood bar with friendly atmosphere'];
                return options[idx % options.length];
              }
              if (t === 'attraction') {
                if (tags.tourism === 'viewpoint') return 'Panoramic viewpoint with scenic vistas';
                if (tags.tourism === 'museum') return 'Cultural museum showcasing local history';
                if (tags.historic === 'yes' || tags.building === 'church') return 'Historic landmark with architectural significance';
                if (name.toLowerCase().includes('park')) return 'Natural attraction and outdoor recreation area';
                if (name.toLowerCase().includes('beach')) return 'Coastal attraction with beach access';
                return `Notable ${tags['addr:city'] || 'local'} landmark worth visiting`;
              }
              if (t === 'park') {
                if (tags.leisure === 'garden') return 'Landscaped garden and green space';
                if (tags.leisure === 'playground') return 'Family-friendly park with playground facilities';
                return 'Public park ideal for relaxation and walks';
              }
              return `Interesting ${t} in the area`;
            };

            const recommendations = nearItems.slice(0, 12).map((p: any, idx: number) => ({
              name: p.name,
              type: p.type || 'other',
              // brief one-line description using cuisine/tags when available
              description: briefDescriptionFor(p, idx),
              distance: formatDistanceForPrompt(p.distanceMeters),
              walkingTime: (p.distanceMeters && p.distanceMeters >= 0) ? `${Math.max(2, Math.round((p.distanceMeters/1000)/5*60))} min walk` : '',
              lat: p.lat,
              lon: p.lon,
              reason: `Located in Batangas province, within 5km of ${hotelName}`,
              address: p.address,
              confidence: 'low',
              imageUrl: `https://source.unsplash.com/400x300/?${encodeURIComponent(p.type + ',batangas')}`,
            }));

            return NextResponse.json({ recommendations, debugPois: elements });
          }
        }
      } catch (e) {
        console.error('Batangas POI fetch failed', e);
      }

      // Fallback small samples if Batangas fetch fails or returned no far items
      const sampleAttraction = {
        name: 'Taal Volcano Viewpoint',
        type: 'attraction',
        // brief descriptive label
        description: 'Scenic viewpoint overlooking Taal Volcano',
        distance: '1.8 km',
        walkingTime: '22 min walk',
        lat: latNum + 0.016, // ~1.8km north-ish
        lon: lonNum - 0.008,
        reason: `Iconic viewpoint near ${hotelName}`,
        address: 'Taal, Batangas',
        confidence: 'low',
        imageUrl: `https://source.unsplash.com/400x300/?viewpoint,volcano,taal`
      };

      const sampleRestaurant = {
        name: 'Casa Batangas Cafe',
        type: 'cafe',
        // brief descriptive label
        description: 'Cozy cafe serving Filipino breakfasts and coffee',
        distance: '350 m',
        walkingTime: '5 min walk',
        lat: latNum + 0.003, // ~300m
        lon: lonNum + 0.002,
        reason: `Popular nearby dining option close to ${hotelName}`,
        address: 'Main St, Nearby Town',
        confidence: 'high',
        imageUrl: `https://source.unsplash.com/400x300/?restaurant,filipino,food`
      };

      return NextResponse.json({ recommendations: [sampleRestaurant, sampleAttraction], debugPois });
    }

    return NextResponse.json({ ...res, debugPois });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
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

function formatDistanceForPrompt(meters: number) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
