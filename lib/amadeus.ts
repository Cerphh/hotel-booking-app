export interface HotelRoomOffer {
  roomType?: string;
  price?: number;
  currency?: string;
  amenities?: string[];
}

interface FetchHotelOffersParams {
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
}

export async function fetchHotelOffers({
  lat,
  lon,
  checkIn,
  checkOut,
}: FetchHotelOffersParams): Promise<HotelRoomOffer[]> {
  try {
    // Use absolute URL for server-side
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `${baseUrl}/api/hotel-offers?lat=${lat}&lon=${lon}&checkIn=${checkIn}&checkOut=${checkOut}`;
    
    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Hotel offers API returned non-OK:", res.status);
      return [];
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      console.warn("Unexpected hotel-offers response format:", data);
      return [];
    }

    const offers: HotelRoomOffer[] = data.flatMap((hotel: any) => {
      if (!hotel || !Array.isArray(hotel.offers)) return [];

      return hotel.offers.map((offer: any): HotelRoomOffer => ({
        roomType: offer?.room?.type || "Unknown",
        price: Number(offer?.price?.total) || undefined,
        currency: offer?.price?.currency || "USD",
        amenities: Array.isArray(offer?.room?.amenities) ? offer.room.amenities : [],
      }));
    });

    return offers;
  } catch (err) {
    console.error("fetchHotelOffers error:", err);
    return [];
  }
}
