// lib/amadeus.ts (DEPRECATED)
// Amadeus integration was removed in favor of a local fallback in
// `app/api/hotels/route.ts`. This file remains as a minimal shim so any
// remaining imports do not break development. It intentionally returns an
// empty list of offers.

export interface HotelRoomOffer {
  roomType?: string;
  price?: number;
  currency?: string;
  amenities?: string[];
  provider?: string;
  availability?: number;
}

export async function fetchHotelOffers(_opts: { lat: number; lon: number; checkIn: string; checkOut: string }): Promise<HotelRoomOffer[]> {
  return [];
}
