"use client";
import { Hotel } from "@/lib/osm-hotels";

interface HotelCardProps {
  hotel: Hotel & {
    price?: number;
    availability?: number;
    imageUrl?: string;
    amenities?: string[];
  };
  onBook?: (hotel: Hotel) => void;
  onViewDetails?: (hotel: Hotel) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (hotelId: string) => void;
  isBooked?: boolean;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  onBook,
  onViewDetails,
  isFavorite = false,
  onToggleFavorite,
  isBooked = false,
}) => {
  return (
    <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 h-full flex flex-col">
      {/* Image Container */}
      <div className="relative h-48 w-full bg-gray-100 dark:bg-gray-800 overflow-hidden group">
        <img
          src={hotel.imageUrl || "https://via.placeholder.com/600x400"}
          alt={hotel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(hotel.id)}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-md transition ${
              isFavorite
                ? "bg-red-500 text-white"
                : "bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
            }`}
          >
            ♥
          </button>
        )}

        {/* Status Badge */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          {hotel.price && (
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md">
              ₱{hotel.price.toLocaleString()}
            </span>
          )}
          {hotel.availability !== undefined && hotel.availability > 0 && (
            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md">
              {hotel.availability} rooms
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-1">{hotel.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {hotel.address || hotel.location}
          </p>
        </div>

        {/* Amenities */}
        {hotel.amenities && hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hotel.amenities.slice(0, 2).map((amenity, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
              >
                {amenity}
              </span>
            ))}
            {hotel.amenities.length > 2 && (
              <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-full">
                +{hotel.amenities.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto pt-3">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(hotel)}
              className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Details
            </button>
          )}
          {onBook && (
            <button
              onClick={() => onBook(hotel)}
              disabled={hotel.availability === 0 || isBooked}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white transition ${
                hotel.availability === 0 || isBooked
                  ? "bg-gray-400 cursor-not-allowed opacity-60"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isBooked ? "✓ Booked" : "Book Now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
