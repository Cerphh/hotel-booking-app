"use client";

import { useAuth } from "@/lib/auth-context";
import { HotelCard } from "@/components/hotel-card";
import { MOCK_HOTELS } from "@/lib/hotels-data";
import { redirect } from "next/navigation";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useState, useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Save favorites to localStorage
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
      // Redirect to sign-in page
      redirect("/signin");
    } else {
      redirect(`/booking/${hotelId}`);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

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
          <p className="text-zinc-600 dark:text-zinc-400">
            Discover your perfect hotel stay
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {MOCK_HOTELS.map((hotel) => (
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
      </motion.div>
    </div>
  );
}
