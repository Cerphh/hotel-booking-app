"use client";

import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { redirect } from "next/navigation";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { searchHotelsByCity, Hotel as OSMHotel, CITY_CENTERS } from "@/lib/osm-hotels";
import { fetchHotelOffers } from "@/lib/amadeus";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

interface Hotel extends OSMHotel {
  price?: number;
  currency?: string;
  roomType?: string;
  amenities?: string[];
  availability?: number;
  imageUrl?: string;
}

const POPULAR_CITIES = Object.keys(CITY_CENTERS); // Use all city centers

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const checkIn = today.toISOString().split("T")[0];
const checkOut = tomorrow.toISOString().split("T")[0];

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
    const savedFavorites = localStorage.getItem("favorites");
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, [mounted]);

  // Fetch hotels from OSM + Amadeus
  useEffect(() => {
    if (!mounted) return;

    const fetchHotels = async () => {
      setLoading(true);
      try {
        const osmResults = await Promise.all(
          POPULAR_CITIES.map((city) => searchHotelsByCity(city))
        );
        const osmHotels = osmResults.flat();

        const enrichedHotels: Hotel[] = [];

        for (const osmHotel of osmHotels.slice(0, 40)) {
          if (!osmHotel.latitude || !osmHotel.longitude) continue;

          const offers = await fetchHotelOffers({
            lat: osmHotel.latitude,
            lon: osmHotel.longitude,
            checkIn,
            checkOut,
          });

          if (offers.length > 0) {
            const bestOffer = offers[0];
            enrichedHotels.push({
              ...osmHotel,
              price: parseFloat(bestOffer.price ?? "0"),
              currency: bestOffer.currency ?? "PHP",
              amenities: bestOffer.amenities ?? ["WiFi", "Air conditioning"],
              roomType: bestOffer.roomType ?? "Standard Room",
              availability: offers.length,
              imageUrl: `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(osmHotel.name)}`,
            });
          } else {
            enrichedHotels.push({
              ...osmHotel,
              price: Math.floor(Math.random() * 4000) + 1500,
              currency: "PHP",
              amenities: ["No data available"],
              roomType: "Unknown",
              availability: 0,
              imageUrl: `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(osmHotel.name)}`,
            });
          }

          await new Promise((r) => setTimeout(r, 1200));
        }

        setHotels(enrichedHotels);
        setFilteredHotels(enrichedHotels);
      } catch (err) {
        console.error("Failed to fetch hotels:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [mounted]);

  // Handle search button click
  const handleSearch = () => {
    setSearching(true);
    setTimeout(() => {
      setSearchTerm(inputValue);
      setSearching(false);
    }, 200); // Slight delay to show spinner
  };

  // Filter hotels whenever searchTerm changes
  useEffect(() => {
    if (hotels.length === 0) return;

    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      setFilteredHotels(hotels);
      return;
    }

    const keywords = term.split(" ").filter((k) => k !== "");

    const filtered = hotels.filter((h) =>
      keywords.every((kw) => {
        const kwNumber = Number(kw);
        return (
          h.name.toLowerCase().includes(kw) ||
          h.location.toLowerCase().includes(kw) ||
          h.amenities?.some((a) => a.toLowerCase().includes(kw)) ||
          (!isNaN(kwNumber) && h.price !== undefined && h.price <= kwNumber)
        );
      })
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

  const handleBook = (hotel: Hotel) => {
    if (!user) {
      alert("Please sign in to book a hotel");
      redirect("/signin");
      return;
    }
    localStorage.setItem(
      "selectedHotel",
      JSON.stringify({ ...hotel, checkIn, checkOut, guests: 1 })
    );
    redirect(`/booking/${hotel.id}`);
  };

  const handleViewMap = (hotel: Hotel) => setSelectedHotel(hotel);
  const handleCloseMap = () => setSelectedHotel(null);

  if (!mounted) return null;

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
            Where Every Stay Feels Right.
          </p>

          {/* Search bar with button */}
          <div className="flex max-w-md gap-2">
            <Input
              type="text"
              placeholder="Search by hotel, city, amenities, or price..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
            >
              {searching ? (
                <div className="w-5 h-5 border-4 border-blue-100 border-t-transparent border-solid rounded-full animate-spin"></div>
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
            <p className="mt-4 text-blue-600 dark:text-blue-400">Loading hotels...</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredHotels.map((hotel, index) => (
              <motion.div key={hotel.id + index} variants={staggerItem}>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md overflow-hidden flex flex-col">
                  {/* Hotel Image */}
                  <div className="h-48 w-full overflow-hidden">
                    <img
                      src={hotel.imageUrl}
                      alt={hotel.name}
                      className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Hotel Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-black dark:text-white">
                        {hotel.name}
                      </h3>
                      <button
                        onClick={() => handleFavorite(hotel.id)}
                        className={`p-1 rounded-full ${
                          favorites.includes(hotel.id)
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        ♥
                      </button>
                    </div>

                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {hotel.location}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {hotel.amenities?.slice(0, 3).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex justify-between items-center gap-2">
                      <span className="text-lg font-bold text-black dark:text-white">
                        {hotel.currency ?? "₱"}
                        {hotel.price?.toLocaleString() ?? "N/A"}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewMap(hotel)}
                          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                        >
                          View Map
                        </button>
                        <button
                          onClick={() => handleBook(hotel)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && filteredHotels.length === 0 && (
          <p className="text-center text-zinc-600 dark:text-zinc-400 py-12">
            No hotels found.
          </p>
        )}
      </motion.div>

      {/* Map Modal */}
      {selectedHotel && (
        <motion.div
          className="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center z-50 transition-all"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg overflow-hidden w-full max-w-3xl"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-black dark:text-white">
                {selectedHotel.name}
              </h2>
              <button
                onClick={handleCloseMap}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="h-[400px] w-full">
              {selectedHotel.latitude && selectedHotel.longitude ? (
                <MapContainer
                  center={[selectedHotel.latitude, selectedHotel.longitude]}
                  zoom={15}
                  className="h-full w-full z-0"
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker
                    position={[selectedHotel.latitude, selectedHotel.longitude]}
                    icon={L.icon({
                      iconUrl:
                        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                      iconAnchor: [12, 41],
                    })}
                  >
                    <Popup>{selectedHotel.name}</Popup>
                  </Marker>
                </MapContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 dark:text-zinc-400">
                  Location not available.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
