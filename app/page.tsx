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
  const [hotels, setHotels] = useState<any[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
  setLoadingHotels(true);
  setError(null);
  import("@/lib/amadeus").then(({ searchHotels }) => {
    searchHotels("NYC")
      .then((data) => {
        console.log("Amadeus hotels data:", data); // <--- check structure
        setHotels(data || []);
        setLoadingHotels(false);
      })
      .catch((err) => {
        setError("Failed to fetch hotels. Try again later.");
        setLoadingHotels(false);
      });
  });
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
      redirect("/signin");
    } else {
      redirect(`/booking/${hotelId}`);
    }
  };

  if (loading || loadingHotels) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg text-red-600">{error}</p>
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
          {hotels.map((hotel: any) => (
  <motion.div key={hotel.hotelId || hotel.id} variants={staggerItem}>
    <HotelCard
      hotel={{
        id: hotel.hotelId || hotel.id,
        name: hotel.name,
        description: hotel.description || hotel.name,
        location: hotel.cityCode || hotel.location,
        price: hotel.offers?.[0]?.price?.total || 0, // use actual API price
        rating: hotel.rating || 0,
        reviews: hotel.reviews || 0,
        image: hotel.media?.[0]?.uri || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&h=400&fit=crop",
        amenities: hotel.amenities || [],
        availability: hotel.availability || 0,
      }}
      isFavorited={favorites.includes(hotel.hotelId || hotel.id)}
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
