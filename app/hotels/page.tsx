"use client";

import { useAuth } from "@/lib/auth-context";
import { HotelCard } from "@/components/hotel-card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { redirect } from "next/navigation";
import { fetchHotelOffers } from "@/lib/amadeus";

// Define Hotel type
interface Hotel {
  id: string;
  name: string;
  description?: string;
  location?: string;
  price?: number;
  rating?: number;
  reviews?: number;
  image?: string;
  amenities?: string[];
  availability?: number;
}

export default function HotelsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) {
      setTimeout(() => setFavorites(JSON.parse(savedFavorites)), 0);
    }
  }, []);

  // Fetch hotels based on search term
  useEffect(() => {
    if (searchTerm.length < 2) {
      setHotels([]);
      setError(null);
      return;
    }

    const fetchHotels = async () => {
      setLoading(true);
      setError(null);
      try {
        const data: Hotel[] = await fetchHotelOffers(searchTerm);
        setHotels(data);
      } catch (err: unknown) {
        console.error(err);
        setError((err as Error).message || "Failed to fetch hotel offers.");
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [searchTerm]);

  // Handle favorite toggle
  const handleFavorite = (hotelId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(hotelId)
        ? prev.filter((id) => id !== hotelId)
        : [...prev, hotelId];
      localStorage.setItem("favorites", JSON.stringify(updated));
      return updated;
    });
  };

  // Handle booking
  const handleBook = (hotelId: string) => {
    if (!user) {
      alert("Please sign in to book a hotel");
      redirect("/signin");
    } else {
      redirect(`/booking/${hotelId}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Explore Hotels
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Discover your perfect hotel stay from our collection of luxury properties
          </p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Input
              type="text"
              placeholder="Search by hotel name or city code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md"
            />
          </motion.div>
        </div>

        {loading ? (
          <p className="text-center text-zinc-600 dark:text-zinc-400 py-12">Loading hotels...</p>
        ) : error ? (
          <p className="text-center text-red-600 py-12">{error}</p>
        ) : hotels.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {hotels.map((hotel: Hotel) => (
              <motion.div key={hotel.id} variants={staggerItem}>
                <HotelCard
                  hotel={{
                    id: hotel.id,
                    name: hotel.name,
                    description: hotel.description || "No description available",
                    location: hotel.location || "Unknown",
                    price: hotel.price || 100,
                    rating: hotel.rating || 0,
                    reviews: hotel.reviews || 0,
                    image: hotel.image || "/placeholder.jpg",
                    amenities: hotel.amenities || [],
                    availability: hotel.availability || 0,
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
            No hotels found matching &quot;{searchTerm}&quot;
          </p>
        )}
      </motion.div>
    </div>
  );
}
