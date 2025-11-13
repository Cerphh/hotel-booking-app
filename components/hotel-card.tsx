"use client";
import Image from "next/image";
import { Hotel } from "@/lib/osm-hotels";

interface HotelCardProps {
  hotel: Hotel;
}

export const HotelCard: React.FC<HotelCardProps> = ({ hotel }) => {
  return (
    <div className="relative bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200">
      <div className="relative h-48 w-full bg-gray-100">
        <Image
          src={`/placeholder.jpg`}
          alt={hotel.name}
          fill
          className="object-cover"
          unoptimized
        />

        {/* Price badge */}
        {hotel.pricePerNight && (
          <div className="absolute bottom-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-sm font-semibold shadow-md">
            ₱{hotel.pricePerNight.toLocaleString()}
          </div>
        )}
      </div>

      <div className="p-4 space-y-1">
        <h3 className="text-lg font-semibold">{hotel.name}</h3>
        <p className="text-sm text-gray-600">{hotel.location}</p>

        {hotel.roomType && (
          <p className="text-sm">
            Room Type: <span className="font-medium">{hotel.roomType}</span>
          </p>
        )}

        {hotel.amenities && hotel.amenities.length > 0 && (
          <p className="text-sm text-gray-500">Amenities: {hotel.amenities.join(", ")}</p>
        )}

        <a
          href={`https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=18/${hotel.latitude}/${hotel.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm mt-1 block"
        >
          View on Map
        </a>
      </div>
    </div>
  );
};
