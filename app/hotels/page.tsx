"use client";

import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { redirect } from "next/navigation";
import {
  searchHotelsByCity,
  Hotel as OSMHotel,
  CITY_CENTERS,
} from "@/lib/osm-hotels";

interface Hotel extends OSMHotel {
  price?: number;
  rating?: number;
  reviews?: number;
  image?: string;
  amenities?: string[];
  availability?: number;
}

// Popular cities include Metro Manila component cities + CALABARZON provinces
const POPULAR_CITIES = [
  // Metro Manila cities
  "Manila", "Quezon City", "Makati", "Pasig", "Taguig",
  "Mandaluyong", "Parañaque", "Las Piñas", "Muntinlupa",
  "Navotas", "Valenzuela", "Caloocan", "Malabon", "Marikina", "Pasay",

  // CALABARZON provinces
  "Cavite", "Laguna", "Batangas", "Rizal", "Quezon",

  // Other major cities
  "Cebu", "Davao del Sur", "Baguio", "Palawan",
];

// --- HotelCard Component ---
interface HotelCardProps {
  hotel: {
    id: string;
    name: string;
    location: string;
    price: number;
    rating: number;
    reviews: number;
    image: string;
    amenities: string[];
    availability: number;
  };
  isFavorited: boolean;
  onFavorite: (hotelId: string) => void;
  onBook: (hotelId: string) => void;
}

const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  isFavorited,
  onFavorite,
  onBook,
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md overflow-hidden flex flex-col">
      {/* Image */}
      <img
        src={hotel.image}
        alt={hotel.name}
        className="h-48 w-full object-cover"
      />

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-black dark:text-white">
            {hotel.name}
          </h3>
          <button
            onClick={() => onFavorite(hotel.id)}
            className={`p-1 rounded-full ${
              isFavorited ? "text-red-500" : "text-gray-400"
            }`}
          >
            ♥
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {hotel.location}
        </p>

        {/* Amenities as oval badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {hotel.amenities.map((amenity, idx) => (
            <span
              key={idx}
              className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium"
            >
              {amenity}
            </span>
          ))}
        </div>

        {/* Price and book button */}
        <div className="mt-4 flex justify-between items-center">
          <span className="text-lg font-bold text-black dark:text-white">
            ₱{hotel.price.toLocaleString()}
          </span>
          <button
            onClick={() => onBook(hotel.id)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
};

// --- HotelsPage Component ---
export default function HotelsPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Load favorites from localStorage
  useEffect(() => {
    if (!mounted) return;
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, [mounted]);

  // Progressive fetch hotels
  useEffect(() => {
    if (!mounted) return;

    const fetchHotels = async () => {
      setLoading(true);
      setError(null);

      try {
        const allHotels: Hotel[] = [];

        // Fetch popular cities first
        for (const city of POPULAR_CITIES) {
          const cityHotels = await searchHotelsByCity(city);
          allHotels.push(...cityHotels);
        }

        setHotels(allHotels);
        setFilteredHotels(allHotels);

        // Fetch remaining cities in the background
        const remainingCities = Object.keys(CITY_CENTERS).filter(
          (c) => !POPULAR_CITIES.includes(c)
        );

        for (const city of remainingCities) {
          const cityHotels = await searchHotelsByCity(city);
          setHotels((prev) => [...prev, ...cityHotels]);
          setFilteredHotels((prev) => [...prev, ...cityHotels]);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch hotels.");
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [mounted]);

  // Local search/filter
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredHotels(hotels);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = hotels.filter(
      (hotel) =>
        hotel.name.toLowerCase().includes(term) ||
        hotel.location.toLowerCase().includes(term)
    );
    setFilteredHotels(filtered);
  }, [searchTerm, hotels]);

  const handleFavorite = (hotelId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(hotelId)
        ? prev.filter((id) => id !== hotelId)
        : [...prev, hotelId];
      localStorage.setItem("favorites", JSON.stringify(updated));
      return updated;
    });
  };

  const handleBook = (hotelId: string) => {
    if (!user) {
      alert("Please sign in to book a hotel");
      redirect("/signin");
    } else {
      redirect(`/booking/${hotelId}`);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header and search */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Explore Hotels
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Discover your perfect hotel stay
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Input
              type="text"
              placeholder="Search by hotel name or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md"
            />
          </motion.div>
        </div>

        {/* Hotel list */}
        {loading && hotels.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <p className="text-center text-red-600 py-12">{error}</p>
        ) : filteredHotels.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredHotels.map((hotel, index) => (
              <motion.div
                key={`${hotel.id}-${hotel.latitude}-${hotel.longitude}-${index}`}
                variants={staggerItem}
              >
                <HotelCard
                  hotel={{
                    id: hotel.id,
                    name: hotel.name,
                    location: hotel.location || "Unknown",
                    price: hotel.price || "0.00",
                    rating: hotel.rating || Math.floor(Math.random() * 5) + 1,
                    reviews: hotel.reviews || Math.floor(Math.random() * 500),
                    image: hotel.image || "/placeholder.jpg",
                    amenities: hotel.amenities || ["No Available"],
                    availability: hotel.availability || Math.floor(Math.random() * 10) + 1,
                  }}
                  isFavorited={favorites.includes(hotel.id)}
                  onFavorite={handleFavorite}
                  onBook={handleBook}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <p className="text-center text-zinc-600 dark:text-zinc-400 py-12">
            No hotels found for your search.
          </p>
        )}
      </motion.div>
    </div>
  );
}
