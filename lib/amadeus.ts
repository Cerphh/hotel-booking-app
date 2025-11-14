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
    const res = await fetch(
      `/api/hotel-offers?lat=${lat}&lon=${lon}&checkIn=${checkIn}&checkOut=${checkOut}`
    );

    if (!res.ok) return [];

    const data = await res.json();

    return data.flatMap((hotel: any) =>
      hotel.offers?.map((offer: any) => ({
        roomType: offer.room?.type,
        price: offer.price?.total,
        currency: offer.price?.currency,
        amenities: offer.room?.amenities || [],
      })) || []
    );
  } catch (err) {
    console.error("Amadeus fetch error:", err);
    return [];
  }
}
