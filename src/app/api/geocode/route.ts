/**
 * app/api/geocode/route.ts
 * GET /api/geocode?q=<address>
 *
 * Proxies the request to OpenStreetMap Nominatim and returns coordinates.
 * Running this server-side:
 *   1. Hides the user's location from third-party telemetry.
 *   2. Lets us set a proper User-Agent (Nominatim requires one).
 *   3. Avoids CORS issues on mobile.
 */

import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SunsetMessages/1.0 (https://sunset.local)';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required.' }, { status: 400 });
  }

  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en',
      },
      // Revalidate at most once per 10 minutes for the same query
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Nominatim returned HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!data.length) {
      return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
    }

    const result: GeocodeResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to reach Nominatim API.' }, { status: 502 });
  }
}
