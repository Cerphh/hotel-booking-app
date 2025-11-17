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
import { useMap } from "react-leaflet";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  FirestoreError,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import app from "@/lib/firebase";

let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");

  if (L?.Icon?.Default?.prototype) {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }
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
  image?: string;
  description?: string;
}

const checkIn = new Date().toISOString().split("T")[0];
const checkOut = (() => {
  const tomorrow = new Date();
  tomorrow.setDate(new Date().getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
})();

const reverseCache = new Map<string, string>();
let firestorePermissionDenied = false;

// Toggle to disable hotel persistence (useful for dev when Firestore rules
// block unauthenticated writes). Set `NEXT_PUBLIC_DISABLE_HOTEL_PERSIST=true`
// in your `.env.local` to skip writes silently.
const DISABLE_HOTEL_PERSIST = (process.env.NEXT_PUBLIC_DISABLE_HOTEL_PERSIST || "false").toLowerCase() === "true";

async function safeSetDoc(ref: any, data: any, opts?: any) {
  if (DISABLE_HOTEL_PERSIST) return;

  try {
    if (opts) {
      await setDoc(ref, data, opts);
    } else {
      await setDoc(ref, data);
    }
  } catch (e: any) {
    const code = e?.code || e?.message || String(e);
    if (!firestorePermissionDenied && String(code).toLowerCase().includes("permission")) {
      firestorePermissionDenied = true;
      console.warn("Firestore write blocked: missing permissions. Persisted mock data will be skipped until rules/auth are updated.");
    } else if (!String(code).toLowerCase().includes("permission")) {
      console.warn("Failed to persist hotel mock data", e);
    }
  }
}

async function getExactAddress(lat: number, lon: number, retries = 3): Promise<string> {
  const key = `${lat},${lon}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`/api/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
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

function AutoFitMap({ hotel }: { hotel: Hotel }) {
  const map = useMap();
  useEffect(() => {
    if (hotel && map) {
      map.setView([hotel.latitude, hotel.longitude], 16);
    }
  }, [hotel, map]);
  return null;
}

export default function HotelsPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [userBookings, setUserBookings] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "map">("cards");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem("favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, [mounted]);

  // Fetch user bookings from Firestore
  useEffect(() => {
    if (!mounted || !user?.email) {
      setUserBookings([]);
      return;
    }

    const db = getFirestore(app);
    const q = query(collection(db, "bookings"), where("userEmail", "==", user.email));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookedHotelIds = snapshot.docs.map((doc) => doc.data().hotelId || doc.data().id);
        setUserBookings(bookedHotelIds);
      },
      (error: FirestoreError) => {
        console.error("Error fetching user bookings:", error);
      }
    );

    return () => unsubscribe();
  }, [mounted, user?.email]);

  useEffect(() => {
    if (!mounted) return;

    const fetchHotels = async () => {
      setLoading(true);
      try {
        const osmHotels = await searchHotelsByCity("Batangas");
        console.log("fetchHotels: osmHotels returned", Array.isArray(osmHotels) ? osmHotels.length : typeof osmHotels);
        const hotelsToLoad = osmHotels.slice(0, 100);

        // Build a local array and set state once to avoid race conditions
        const collected: Hotel[] = [];

        for (const osmHotel of hotelsToLoad) {
          if (!osmHotel.latitude || !osmHotel.longitude) continue;

          const db = getFirestore(app);
          const hotelDocRef = doc(db, "hotels", String(osmHotel.id));

          try {
            const snap = await getDoc(hotelDocRef);

            let hotel: Hotel;

            if (snap.exists()) {
              const stored: any = snap.data();
              hotel = {
                ...osmHotel,
                address: stored.address || `${osmHotel.latitude}, ${osmHotel.longitude}`,
                imageUrl: stored.imageUrl || osmHotel.imageUrl || `https://source.unsplash.com/600x400/?hotel`,
                price: stored.price,
                currency: stored.currency || "PHP",
                availability: stored.availability,
                roomType: stored.roomType,
                amenities: stored.amenities,
                description: stored.description,
              };

              if (!stored.address) {
                // fetch address async but update after initial render
                getExactAddress(osmHotel.latitude, osmHotel.longitude).then((addr) => {
                  setHotels((prev) => prev.map((h) => (h.id === hotel.id ? { ...h, address: addr } : h)));
                  safeSetDoc(hotelDocRef, { ...stored, address: addr }, { merge: true });
                });
              }
            } else {
              const randomPrice = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000; // 1000-5000
              const randomAvailability = Math.floor(Math.random() * 11); // 0-10
              const roomTypes = ["Standard", "Deluxe", "Suite", "Family", "Twin"];
              const chosenRoom = roomTypes[Math.floor(Math.random() * roomTypes.length)];
              const image = osmHotel.imageUrl || `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(osmHotel.name)}`;

              const storedData = {
                id: String(osmHotel.id),
                name: osmHotel.name,
                latitude: osmHotel.latitude,
                longitude: osmHotel.longitude,
                address: `${osmHotel.latitude}, ${osmHotel.longitude}`,
                imageUrl: image,
                price: randomPrice,
                currency: "PHP",
                availability: randomAvailability,
                roomType: chosenRoom,
                amenities: [],
                description: `${chosenRoom} - Available: ${randomAvailability}`,
              } as any;

              await safeSetDoc(hotelDocRef, storedData);

              hotel = {
                ...osmHotel,
                address: storedData.address,
                imageUrl: storedData.imageUrl,
                price: storedData.price,
                currency: storedData.currency,
                availability: storedData.availability,
                roomType: storedData.roomType,
                amenities: storedData.amenities,
                description: storedData.description,
              };

              // fetch address async and merge
              getExactAddress(osmHotel.latitude, osmHotel.longitude).then((addr) => {
                setHotels((prev) => prev.map((h) => (h.id === hotel.id ? { ...h, address: addr } : h)));
                safeSetDoc(hotelDocRef, { address: addr }, { merge: true });
              });
            }

            // Try to merge external offers before pushing into collected
            try {
              const res = await axios.get("/api/hotels", {
                params: {
                  lat: osmHotel.latitude,
                  lon: osmHotel.longitude,
                  checkIn,
                  checkOut,
                },
              });

              const offers = res.data as any[];
              if (Array.isArray(offers) && offers.length > 0) {
                Object.assign(hotel, offers[0]);
              }
            } catch {
              // ignore
            }

            collected.push(hotel);
          } catch (e) {
            console.warn("Error reading/persisting hotel doc", e);
          }
        }

        // set all hotels at once
        console.log("fetchHotels: collected count", collected.length);
        setHotels(collected);
        console.log("fetchHotels: hotels state updated");
      } catch (err) {
        console.error("Failed to fetch hotels", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [mounted]);



  // Update filtered hotels whenever input or hotels change
  useEffect(() => {
    const trimmedInput = inputValue.trim();

    // If input is empty, show all hotels
    if (trimmedInput === "") {
      setFilteredHotels(hotels);
      setSearchLoading(false);
      return;
    }

    // Debounced search for non-empty input
    setSearchLoading(true);
    const timer = setTimeout(() => {
      // Filter based on search keywords (require ALL keywords to match)
      const term = trimmedInput.toLowerCase();
      const keywords = term.split(" ").filter(Boolean);

      const filtered = hotels.filter((h) =>
        // require every keyword to match somewhere on the hotel (AND)
        keywords.every((kw) => {
          const priceNum = Number(kw);
          const isPriceKeyword = !isNaN(priceNum) && priceNum > 0;

          const matchesText =
            (h.name && h.name.toLowerCase().includes(kw)) ||
            (h.location && h.location.toLowerCase().includes(kw)) ||
            (h.address && h.address.toLowerCase().includes(kw)) ||
            (h.amenities && h.amenities.some((a) => a.toLowerCase().includes(kw)));

          const matchesPrice = isPriceKeyword && h.price !== undefined && h.price <= priceNum;

          return Boolean(matchesText) || matchesPrice;
        })
      );

      console.log(`Search term: "${trimmedInput}", Keywords: ${JSON.stringify(keywords)}, Hotels: ${hotels.length}, Filtered: ${filtered.length}`);
      setFilteredHotels(filtered);
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, hotels]);

  const handleFavorite = (hotelId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(hotelId) ? prev.filter((id) => id !== hotelId) : [...prev, hotelId];
      localStorage.setItem("favorites", JSON.stringify(updated));
      
      // Also save full hotel info to localStorage for dashboard
      if (!prev.includes(hotelId)) {
        // Adding to favorites
        const hotel = hotels.find(h => h.id === hotelId);
        if (hotel) {
          const savedHotels: Hotel[] = JSON.parse(localStorage.getItem("savedHotels") || "[]");
          const hotelData: Hotel = {
            id: hotel.id,
            name: hotel.name,
            location: hotel.location,
            address: hotel.address,
            image: hotel.imageUrl,
            price: hotel.price,
            amenities: hotel.amenities || [],
            description: `${hotel.roomType || "Room"} - Available: ${hotel.availability || 'N/A'}`,
            latitude: hotel.latitude,
            longitude: hotel.longitude,
          };
          // Avoid duplicates
          if (!savedHotels.find((h) => h.id === hotel.id)) {
            savedHotels.push(hotelData);
            localStorage.setItem("savedHotels", JSON.stringify(savedHotels));
          }
        }
      } else {
        // Removing from favorites
        const savedHotels: Hotel[] = JSON.parse(localStorage.getItem("savedHotels") || "[]");
        const filtered = savedHotels.filter((h) => h.id !== hotelId);
        localStorage.setItem("savedHotels", JSON.stringify(filtered));
      }
      
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

        {/* Search bar and View Toggle */}
        <div className="sticky top-16 z-50 bg-zinc-50 dark:bg-black flex gap-2 mb-6 items-center p-0">
          <div className="relative flex-1 w-1/3">
            <Input
              type="text"
              placeholder="Search by hotel, amenities, or price..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pr-20 rounded-lg"
            />
            {searchLoading && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            <button
              onClick={handleUseCurrentLocation}
              title="Use my location"
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 dark:text-blue-300 ${searchLoading ? "pointer-events-none opacity-50" : ""}`}
            >
              📍
            </button>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === "cards"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              📋 Cards
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === "map"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              🗺️ Map
            </button>
          </div>
        </div>

        {/* Loading */}
        {hotels.length === 0 && loading && (
          <div className="flex flex-col items-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
            <p className="mt-4 text-blue-600">Loading hotels...</p>
          </div>
        )}

        {/* Hotel cards or map */}
        {filteredHotels.length > 0 ? (
          viewMode === "cards" ? (
            // Card View
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
                        {(hotel.amenities && hotel.amenities.length > 0 ? hotel.amenities.slice(0, 3) : ["No Amenities"]).map((a, idx) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full text-xs">{a}</span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">
                          {hotel.availability !== undefined && hotel.availability > 0 ? `Available: ${hotel.availability}` : "No Room Available"}
                        </span>
                      </div>

                      <div className="mt-auto flex justify-between items-center pt-4">
                        <div className="text-lg font-bold text-left">
                          {hotel.price && hotel.price > 0 ? (
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
                            disabled={hotel.availability === 0 || userBookings.includes(hotel.id)}
                            className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                              hotel.availability === 0 || userBookings.includes(hotel.id)
                                ? "bg-gray-400 cursor-not-allowed opacity-60"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {userBookings.includes(hotel.id) ? "Booked" : hotel.availability === 0 ? "Booked" : "Book Now"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            // Map View
            L && (
              <div className="w-full h-96 rounded-xl overflow-hidden shadow-md">
                <MapContainer
                  center={[13.7569, 121.0583]}
                  zoom={12}
                  scrollWheelZoom
                  style={{ width: "100%", height: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {filteredHotels.map((hotel) => (
                    <Marker key={hotel.id} position={[hotel.latitude, hotel.longitude]}>
                      <Popup>
                        <div className="text-sm">
                          <h3 className="font-bold text-base mb-1">{hotel.name}</h3>
                          <p className="text-xs mb-2">{hotel.address}</p>
                          {hotel.price && (
                            <p className="text-xs font-semibold text-blue-600 mb-2">₱{hotel.price.toLocaleString()}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBook(hotel)}
                              disabled={hotel.availability === 0 || userBookings.includes(hotel.id)}
                              className={`px-2 py-1 rounded text-xs font-medium transition ${
                                hotel.availability === 0 || userBookings.includes(hotel.id)
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )
          )
        ) : (
          // show a helpful message when no results are found
          !loading && (
            <div className="text-center py-12">
              {searchLoading ? (
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              ) : inputValue.trim() === "" ? (
                <div>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">No hotels loaded yet.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Restart Website
                  </button>
                </div>
              ) : (
                <p className="text-zinc-600 dark:text-zinc-400">No hotels match your search.</p>
              )}
            </div>
          )
        )}

        {/* Map Modal */}
        {selectedHotel && L && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="relative w-11/12 md:w-3/4 h-2/3 rounded-xl overflow-hidden shadow-lg">
              {/* Close button */}
              <button
                onClick={handleCloseMap}
                className="absolute top-2 right-2 z-999 text-white bg-red-500 rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 text-lg font-bold"
              >
                ×
              </button>
              <MapContainer
                center={[selectedHotel.latitude, selectedHotel.longitude]}
                zoom={16}
                scrollWheelZoom
                style={{ width: "100%", height: "100%" }}
              >
                <AutoFitMap hotel={selectedHotel} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={[selectedHotel.latitude, selectedHotel.longitude]}>
                  <Popup>
                    <div>
                      <h3 className="font-bold">{selectedHotel.name}</h3>
                      <p>{selectedHotel.address}</p>
                      {selectedHotel.price && (
                        <p>₱{selectedHotel.price.toLocaleString()} / {selectedHotel.currency ?? "PHP"}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
