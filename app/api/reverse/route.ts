import { NextResponse } from 'next/server';

// In-memory cache for reverse lookups (dev-only, kept in server memory).
const reverseCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Server-side proxy for Nominatim reverse geocoding to avoid browser CORS.
// Adds retries, timeout, and caching to be resilient to transient network problems.
export async function GET(req: Request) {
  try {
    const base = `http://${(req as any).headers?.get?.('host') || 'localhost'}`;
    const urlObj = new URL(req.url as string, base);
    const { searchParams } = urlObj;
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 });
    }

    const cacheKey = `${lat},${lon}`;
    const cached = reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;

    const MAX_ATTEMPTS = 3;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000 + attempt * 2000); // increase timeout per attempt

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'HotBook/1.0 (developer@example.com)'
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.warn('Reverse upstream returned non-OK:', res.status, text);
          lastErr = new Error(`Upstream ${res.status}`);
        } else {
          const data = await res.json();
          // cache and return
          reverseCache.set(cacheKey, { data, ts: Date.now() });
          return NextResponse.json(data);
        }
      } catch (err) {
        lastErr = err;
        console.warn(`Reverse proxy fetch failed (attempt ${attempt}):`, String(err));
        // exponential backoff before retrying
        await delay(500 * attempt);
      }
    }

    console.error('Reverse proxy final error:', lastErr);
    // Return a safe fallback JSON so the client can proceed.
    const fallback = { address: null, fallback: true, error: String(lastErr) };
    reverseCache.set(cacheKey, { data: fallback, ts: Date.now() });
    return NextResponse.json(fallback);
  } catch (err: any) {
    console.error('Reverse proxy error', err?.stack || err);
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}
