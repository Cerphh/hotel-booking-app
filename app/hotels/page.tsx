"use client";

import { useAuth } from "@/lib/auth-context";
import { HotelCard } from "@/components/hotel-card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { redirect } from "next/navigation";
import { searchHotelOffers } from "@/lib/amadeus";

export default function HotelsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, []);

  // Fetch hotels when searchTerm changes
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
        const data = await searchHotelOffers(searchTerm); // fetch hotels from Amadeus

        // Map data to your HotelCard format
        const formatted = data.map((item: any) => {
          const hotel = item.hotel;
          const firstOffer = item.offers?.[0];

          return {
            id: hotel.hotelId || hotel.id,
            name: hotel.name,
            description: hotel.description || hotel.name,
            location: hotel.address?.cityName || hotel.cityCode || "",
            price: firstOffer?.price?.total ? Number(firstOffer.price.total) : 0,
            currency: firstOffer?.price?.currency || "USD",
            rating: hotel.rating || 4.5,
            image:
              hotel.media?.[0]?.uri ||
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&h=400&fit=crop",
            amenities: hotel.amenities || [],
            availability: firstOffer?.availableRooms || 0,
          };
        });

        setHotels(formatted);
      } catch (err: any) {
        setError(err.message || "Failed to fetch hotel offers.");
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [searchTerm]);

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Explore Hotels
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Discover your perfect hotel stay from our collection of luxury properties
          </p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Input
              type="text"
              placeholder="Search by hotel name or city code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md"
            />
          </motion.div>
        </div>

        {/* Hotels Grid */}
        {loading ? (
          <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-4">Loading hotels...</p>
          </motion.div>
        ) : error ? (
          <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-xl text-red-600 mb-4">{error}</p>
            <button
              onClick={() => setSearchTerm("")}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear search
            </button>
          </motion.div>
        ) : hotels.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {hotels.map((hotel) => (
              <motion.div key={hotel.id} variants={staggerItem}>
                <HotelCard
                  hotel={hotel}
                  isFavorited={favorites.includes(hotel.id)}
                  onFavorite={handleFavorite}
                  onBook={handleBook}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-4">
              No hotels found matching "{searchTerm}"
            </p>
            <button
              onClick={() => setSearchTerm("")}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear search
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
