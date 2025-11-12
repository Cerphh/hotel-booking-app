"use client";

import { Hotel } from "@/lib/hotels-data"; // your Hotel type
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface HotelCardProps {
  hotel: Hotel;
  isFavorited?: boolean;
  onFavorite?: (hotelId: string) => void;
  onBook?: (hotelId: string) => void;
}

export function HotelCard({ hotel, isFavorited = false, onFavorite, onBook }: HotelCardProps) {
  const [showFavoriteAnimation, setShowFavoriteAnimation] = useState(false);

  const handleFavorite = () => {
    setShowFavoriteAnimation(true);
    onFavorite?.(hotel.id);
    setTimeout(() => setShowFavoriteAnimation(false), 600);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow">
        {/* Image */}
        <div className="relative w-full h-48 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
          <img
            src={hotel.image || "/placeholder.jpg"}
            alt={hotel.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 right-3">
            <motion.button
              onClick={handleFavorite}
              whileTap={{ scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-full p-2 shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${isFavorited ? "fill-red-500 text-red-500" : "text-zinc-400"}`}
              />
            </motion.button>
          </div>
        </div>

        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg">{hotel.name}</CardTitle>
              <CardDescription className="text-sm mt-1">{hotel.location || "Location unavailable"}</CardDescription>
            </div>
            <Badge variant="outline" className="text-yellow-600 border-yellow-600 dark:text-yellow-400 dark:border-yellow-400">
              ⭐ {hotel.rating || 0}
            </Badge>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 pb-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
            {hotel.description || "No description available"}
          </p>

          {/* Amenities */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Amenities</p>
            <div className="flex flex-wrap gap-1">
              {hotel.amenities?.length
                ? hotel.amenities.slice(0, 3).map((amenity, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{amenity}</Badge>
                  ))
                : <Badge variant="secondary" className="text-xs">None</Badge>
              }
            </div>
          </div>

          {/* Availability */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            {hotel.availability || 0} rooms available
          </p>

          {/* Price and Button */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">From</p>
              <p className="text-2xl font-bold text-black dark:text-white">
                ${hotel.price.toLocaleString()} {/* Displays actual price */}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">per night</p>
            </div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => onBook?.(hotel.id)}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Book Now
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
