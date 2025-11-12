"use client";

import { useAuth } from "@/lib/auth-context";
import { HotelCard } from "@/components/hotel-card";
import { MOCK_HOTELS } from "@/lib/hotels-data";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { redirect } from "next/navigation";

export default function HotelsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

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
      // Show a message that login is required
      alert("Please sign in to book a hotel");
      redirect("/");
    } else {
      redirect(`/booking/${hotelId}`);
    }
  };

  // Filter hotels based on search
  const filteredHotels = MOCK_HOTELS.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              placeholder="Search by hotel name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md"
            />
          </motion.div>
        </div>

        {/* Hotels Grid */}
        {filteredHotels.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredHotels.map((hotel) => (
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
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
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
