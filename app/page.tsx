"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Hotel, searchHotelsByCity } from "@/lib/osm-hotels";
import { fetchHotelOffers, HotelRoomOffer } from "@/lib/amadeus";

interface HotelWithOffers extends Hotel {
  offers?: HotelRoomOffer[];
  imageUrl?: string;
}

export default function Home() {
  const [hotels, setHotels] = useState<HotelWithOffers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const checkIn = "2025-11-14";
  const checkOut = "2025-11-15";
  const defaultGuests = 1;

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      setError(null);

      try {
        const cities = ["Manila", "Cebu", "Davao", "Baguio"];
        let allHotels: HotelWithOffers[] = [];

        for (const city of cities) {
          const osmHotels = await searchHotelsByCity(city);

          const hotelsWithOffers = await Promise.all(
            osmHotels.map(async (hotel) => {
              try {
                const offers = await fetchHotelOffers({
                  lat: hotel.latitude,
                  lon: hotel.longitude,
                  checkIn,
                  checkOut,
                });

                // Optional: first image from offers
                const imageUrl =
                  offers?.[0]?.roomType && offers?.[0]?.amenities
                    ? offers
                        ?.find((o) => o.amenities?.length > 0)
                        ?.amenities?.find((a) => a.startsWith("image:"))
                        ?.replace("image:", "")
                    : undefined;

                return { ...hotel, offers, imageUrl };
              } catch {
                return { ...hotel, offers: [], imageUrl: undefined };
              }
            })
          );

          allHotels = [...allHotels, ...hotelsWithOffers];
        }

        if (allHotels.length === 0) setError("No hotels found.");
        setHotels(allHotels);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch hotels.");
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, []);

  if (loading)
    return (
      <div className="flex flex-col items-center mt-20 space-y-4">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-center text-gray-700 font-medium">Loading hotels...</p>
      </div>
    );

  if (error)
    return (
      <p className="text-center mt-20 text-red-600 font-medium">{error}</p>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {hotels.map((hotel) => (
        <div
          key={hotel.id}
          className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100"
        >
          {/* Hotel Image */}
          <div className="relative h-48 w-full bg-gray-100">
            <Image
              src={hotel.imageUrl || "/placeholder.jpg"}
              alt={hotel.name}
              fill
              className="object-cover"
              unoptimized
            />

            {/* Price badge */}
            {hotel.offers?.[0]?.price && (
              <div className="absolute bottom-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-sm font-semibold shadow-md">
                {hotel.offers[0].currency}{" "}
                {hotel.offers[0].price.toLocaleString()}
              </div>
            )}
          </div>

          {/* Hotel Info */}
          <div className="p-4 space-y-2">
            <h3 className="text-lg font-semibold">{hotel.name}</h3>
            <p className="text-sm text-gray-600">{hotel.location}</p>

            {(!hotel.offers || hotel.offers.length === 0) && (
              <p className="text-sm text-gray-500">No offers available</p>
            )}

            {hotel.offers?.map((offer, idx) => (
              <div key={idx} className="border-t border-gray-200 pt-2 mt-2">
                {offer.roomType && (
                  <p className="text-sm font-medium">Room: {offer.roomType}</p>
                )}
                {offer.price && (
                  <p className="text-sm text-green-600">
                    Price: {offer.currency} {offer.price.toLocaleString()}
                  </p>
                )}
                {offer.amenities && offer.amenities.length > 0 && (
                  <p className="text-sm text-gray-500">
                    Amenities: {offer.amenities.join(", ")}
                  </p>
                )}
              </div>
            ))}

            <div className="flex justify-between mt-4">
              <a
                href={`https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=18/${hotel.latitude}/${hotel.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm"
              >
                View on Map
              </a>

              {/* Book Button */}
              <button
                onClick={() => {
                  const hotelToBook = {
                    ...hotel,
                    checkIn,
                    checkOut,
                    guests: defaultGuests,
                  };
                  localStorage.setItem(
                    "selectedHotel",
                    JSON.stringify(hotelToBook)
                  );
                  router.push(`/booking/${hotel.id}`);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                Book
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
