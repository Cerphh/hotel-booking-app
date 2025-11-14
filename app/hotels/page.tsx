"use client";

import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { redirect } from "next/navigation";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { searchHotelsByCity, Hotel as OSMHotel } from "@/lib/osm-hotels";
import axios from "axios";
import dynamic from "next/dynamic";

// Leaflet dynamic import
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
}
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

interface Hotel extends OSMHotel {
  price?: number;
  currency?: string;
  roomType?: string;
  amenities?: string[];
  availability?: number;
  imageUrl?: string;
  address?: string;
}

const checkIn = new Date().toISOString().split("T")[0];
const checkOut = (() => {
  const tomorrow = new Date();
  tomorrow.setDate(new Date().getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
})();

const reverseCache = new Map<string, string>();

// ✅ Fixed reverse geocode with retries
async function getExactAddress(lat: number, lon: number, retries = 3): Promise<string> {
  const key = `${lat},${lon}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const addr = data.address || {};
      const parts = [
        addr.suburb || addr.neighbourhood || addr.village || addr.hamlet,
        addr.city || addr.town || addr.municipality || addr.village,
        "Batangas",
      ].filter(Boolean);

      const address = parts.join(", ") || "Batangas, Philippines";
      reverseCache.set(key, address);
      return address;
    } catch (err) {
      console.warn(`Reverse geocode attempt ${i + 1} failed for ${lat},${lon}:`, err);
      await new Promise((r) => setTimeout(r, (i + 1) * 1000));
    }
  }

  return "Batangas, Philippines";
}

export default function HotelsPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem("favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const fetchHotels = async () => {
      setLoading(true);
      try {
        const osmHotels = await searchHotelsByCity("Batangas");
        const hotelsToLoad = osmHotels.slice(0, 100);

        hotelsToLoad.forEach(async (osmHotel) => {
          if (!osmHotel.latitude || !osmHotel.longitude) return;

          const hotel: Hotel = {
            ...osmHotel,
            address: `${osmHotel.latitude}, ${osmHotel.longitude}`, // fallback
            imageUrl: osmHotel.imageUrl || `https://source.unsplash.com/600x400/?hotel`,
          };

          // Immediately render hotel
          setHotels((prev) => {
            const updated = [...prev, hotel];
            setFilteredHotels(updated);
            return updated;
          });

          // Reverse geocode async
          getExactAddress(osmHotel.latitude, osmHotel.longitude).then((addr) => {
            setHotels((prev) =>
              prev.map((h) => (h.id === hotel.id ? { ...h, address: addr } : h))
            );
            setFilteredHotels((prev) =>
              prev.map((h) => (h.id === hotel.id ? { ...h, address: addr } : h))
            );
          });

          // LiteAPI fetch async
          axios
            .get("/api/hotels", {
              params: {
                lat: osmHotel.latitude,
                lon: osmHotel.longitude,
                checkIn,
                checkOut,
              },
            })
            .then((res) => {
              const offers = res.data;
              if (offers.length > 0) {
                const offer = offers[0];
                setHotels((prev) =>
                  prev.map((h) => (h.id === hotel.id ? { ...h, ...offer } : h))
                );
                setFilteredHotels((prev) =>
                  prev.map((h) => (h.id === hotel.id ? { ...h, ...offer } : h))
                );
              }
            })
            .catch(console.warn);
        });
      } catch (err) {
        console.error("Failed to fetch hotels", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [mounted]);

  const handleSearch = () => {
    setSearching(true);
    setTimeout(() => {
      setSearchTerm(inputValue.trim());
      setSearching(false);
    }, 200);
  };

  useEffect(() => {
    if (!searchTerm) {
      setFilteredHotels(hotels);
      return;
    }
    const term = searchTerm.toLowerCase();
    const keywords = term.split(" ").filter(Boolean);
    const filtered = hotels.filter((h) =>
      keywords.every((kw) => {
        const priceNum = Number(kw);
        return (
          h.name?.toLowerCase().includes(kw) ||
          h.location?.toLowerCase().includes(kw) ||
          h.address?.toLowerCase().includes(kw) ||
          h.amenities?.some((a) => a.toLowerCase().includes(kw)) ||
          (!isNaN(priceNum) && h.price !== undefined && h.price <= priceNum)
        );
      })
    );
    setFilteredHotels(filtered);
  }, [searchTerm, hotels]);

  const handleFavorite = (hotelId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(hotelId) ? prev.filter((id) => id !== hotelId) : [...prev, hotelId];
      localStorage.setItem("favorites", JSON.stringify(updated));
      return updated;
    });
  };

  const handleBook = (hotel: Hotel) => {
    if (!user) {
      alert("Please sign in to book a hotel");
      redirect("/signin");
      return;
    }
    localStorage.setItem("selectedHotel", JSON.stringify({ ...hotel, checkIn, checkOut, guests: 1 }));
    redirect(`/booking/${hotel.id}`);
  };

  const handleViewMap = (hotel: Hotel) => setSelectedHotel(hotel);
  const handleCloseMap = () => setSelectedHotel(null);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || "";
        if (city) {
          setInputValue(city);
          setSearchTerm(city);
        }
      },
      (err) => console.error(err)
    );
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">Explore Batangas!</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">Where Every Stay Feels Right.</p>
        </div>

        <div className="sticky top-16 z-50 bg-zinc-50 dark:bg-black flex gap-2 mb-6 w-1/3 p-0">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search by hotel, amenities, or price..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pr-10 rounded-lg"
            />
            <button
              onClick={handleUseCurrentLocation}
              title="Use my location"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 dark:text-blue-300"
            >
              📍
            </button>
          </div>
          <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Search
          </button>
        </div>

        {hotels.length === 0 && loading && (
          <div className="flex flex-col items-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
            <p className="mt-4 text-blue-600">Loading hotels...</p>
          </div>
        )}

        {filteredHotels.length > 0 && (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredHotels.map((hotel, i) => (
              <motion.div key={hotel.id + i} variants={staggerItem}>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md overflow-hidden flex flex-col">
                  <img
                    src={hotel.imageUrl}
                    className="h-48 w-full object-cover hover:scale-105 transition-transform"
                    alt={hotel.name}
                  />
                  <div className="p-4 flex flex-col flex-1 relative">
                    <div className="flex justify-between">
                      <h3 className="text-lg font-semibold">{hotel.name}</h3>
                      <button
                        onClick={() => handleFavorite(hotel.id)}
                        className={`p-1 rounded-full ${favorites.includes(hotel.id) ? "text-red-500" : "text-gray-400"}`}
                      >
                        ♥
                      </button>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{hotel.address}</p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {(hotel.amenities && hotel.amenities.length > 0 ? hotel.amenities.slice(0, 3) : ["No amenities"]).map((a, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full text-xs">{a}</span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">
                        {hotel.availability !== undefined ? `Available: ${hotel.availability}` : "Availability N/A"}
                      </span>
                      <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">
                        {hotel.roomType ?? "Room type N/A"}
                      </span>
                    </div>

                    <div className="mt-auto flex justify-between items-center pt-4">
                      <div className="text-lg font-bold text-left">
                        {hotel.price !== undefined ? (
                          <>
                            ₱{hotel.price.toLocaleString()}{" "}
                            <span className="text-xs text-zinc-500">/{hotel.currency ?? "PHP"}</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">Php 0.00</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewMap(hotel)}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                          View Map
                        </button>
                        <button
                          onClick={() => handleBook(hotel)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
