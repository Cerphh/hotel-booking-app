"use client";

import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddHotelForm from "@/components/add-hotel-form";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { redirect } from "next/navigation";
import { staggerContainer, staggerItem } from "@/lib/animations";
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
  getDocs,
  orderBy,
  deleteDoc,
  DocumentData,
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

interface Hotel {
  id: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  currency?: string;
  roomType?: string;
  amenities?: string[];
  availability?: number;
  imageUrl?: string;
  address?: string;
  image?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  // any extra fields
  [k: string]: any;
}

const DEFAULT_CHECK_IN = new Date().toISOString().split("T")[0];
const DEFAULT_CHECK_OUT = (() => {
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
      console.warn("Failed to persist hotel data", e);
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
    if (hotel && map && hotel.latitude && hotel.longitude) {
      map.setView([hotel.latitude, hotel.longitude], 16);
    }
  }, [hotel, map]);
  return null;
}

export default function HotelsPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [userBookings, setUserBookings] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "map">("cards");
  const [checkInDate, setCheckInDate] = useState(DEFAULT_CHECK_IN);
  const [checkOutDate, setCheckOutDate] = useState(DEFAULT_CHECK_OUT);

  useEffect(() => {
    if (new Date(checkOutDate).getTime() <= new Date(checkInDate).getTime()) {
      const nextDay = new Date(checkInDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setCheckOutDate(nextDay.toISOString().split("T")[0]);
    }
  }, [checkInDate, checkOutDate]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem("favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, [mounted]);

  // Fetch user bookings from Firestore
  useEffect(() => {
    if (!mounted || !user?.uid) {
      setUserBookings([]);
      return;
    }

    const db = getFirestore(app);
    const q = query(collection(db, "bookings"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookedHotelIds = snapshot.docs.map((doc) => {
          const d = doc.data() as DocumentData;
          return d.hotelId || d.id;
        });
        setUserBookings(bookedHotelIds);
      },
      (error: FirestoreError) => {
        console.error("Error fetching user bookings:", error);
      }
    );

    return () => unsubscribe();
  }, [mounted, user?.uid]);

  // Load hotels from Firestore (real-time)
  useEffect(() => {
    if (!mounted) return;
    setLoading(true);

    const db = getFirestore(app);
    const q = collection(db, "hotels");

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: Hotel[] = [];
        const missingAddressPromises: Promise<void>[] = [];

        snapshot.docs.forEach((d) => {
          const data = d.data() as DocumentData;
          const hotel: Hotel = {
            id: String(data.id ?? d.id),
            name: data.name ?? data.title ?? "",
            latitude: typeof data.latitude === "number" ? data.latitude : parseFloat(String(data.latitude || "")) || undefined,
            longitude: typeof data.longitude === "number" ? data.longitude : parseFloat(String(data.longitude || "")) || undefined,
            address: data.address ?? "",
            imageUrl: data.imageUrl ?? data.image ?? `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(String(data.name ?? ""))}`,
            price: typeof data.price === "number" ? data.price : data.price ? Number(data.price) : undefined,
            currency: data.currency ?? "PHP",
            availability: typeof data.availability === "number" ? data.availability : data.availability ? Number(data.availability) : undefined,
            roomType: data.roomType ?? data.room_type ?? "",
            amenities: Array.isArray(data.amenities) ? data.amenities : (data.amenities ? String(data.amenities).split(",").map((s: string) => s.trim()) : []),
            description: data.description ?? "",
            ...data,
          };

          // If address missing but coords exist, queue reverse geocode and merge back to Firestore (best-effort)
          if ((!hotel.address || hotel.address.trim() === "") && hotel.latitude && hotel.longitude) {
            missingAddressPromises.push(
              (async () => {
                try {
                  const addr = await getExactAddress(hotel.latitude!, hotel.longitude!);
                  hotel.address = addr;
                  // Save back to Firestore (merge) if allowed
                  const docRef = doc(db, "hotels", String(hotel.id));
                  await safeSetDoc(docRef, { address: addr }, { merge: true });
                } catch (err) {
                  // ignore; we already have fallback address
                }
              })()
            );
          }
          list.push(hotel);
        });

        // wait for reverse geocoding tasks to finish (best-effort)
        try {
          await Promise.all(missingAddressPromises);
        } catch {
          // ignore errors
        }

        // sort by availability/price or name (simple stable ordering)
        list.sort((a, b) => {
          if (a.name && b.name) return a.name.localeCompare(b.name);
          return 0;
        });

        // If Firestore returned no hotels, try a localStorage fallback so the UI isn't empty
        if (list.length === 0) {
          try {
            const saved: string | null = localStorage.getItem("savedHotels");
            if (saved) {
              const parsed: Hotel[] = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setHotels(parsed);
                setFilteredHotels(parsed);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            // ignore parse errors
            console.warn("Failed to load savedHotels from localStorage", e);
          }
        }

        setHotels(list);
        setFilteredHotels(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to hotels collection:", err);
        // On error, try localStorage fallback so the page still shows something
        try {
          const saved: string | null = localStorage.getItem("savedHotels");
          if (saved) {
            const parsed: Hotel[] = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHotels(parsed);
              setFilteredHotels(parsed);
            }
          }
        } catch (e) {
          console.warn("Failed to load savedHotels from localStorage after snapshot error", e);
        }

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [mounted]);

  // Update filtered hotels whenever input or hotels change
  useEffect(() => {
    const trimmedInput = inputValue.trim().toLowerCase();

    // If input is empty, show all hotels
    if (trimmedInput === "") {
      setFilteredHotels(hotels);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    // Add a small delay to make it feel more responsive
    const timer = setTimeout(() => {
      const filtered = hotels.filter((h) => {
        const name = (h.name || "").toLowerCase();
        const address = (h.address || "").toLowerCase();
        const amenities = (h.amenities || []).join(" ").toLowerCase();
        const priceStr = h.price ? String(h.price) : "";

        const matchesNamePrefix = name.startsWith(trimmedInput) || name.includes(trimmedInput);
        const matchesAddress = address.includes(trimmedInput);
        const matchesAmenities = amenities.includes(trimmedInput);
        const matchesPrice = priceStr.includes(trimmedInput);

        return matchesNamePrefix || matchesAddress || matchesAmenities || matchesPrice;
      });

      setFilteredHotels(filtered);
      setSearchLoading(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [inputValue, hotels]);

  const handleFavorite = (hotelId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(hotelId) ? prev.filter((id) => id !== hotelId) : [...prev, hotelId];
      localStorage.setItem("favorites", JSON.stringify(updated));

      // Also save full hotel info to localStorage for dashboard
      if (!prev.includes(hotelId)) {
        // Adding to favorites
        const hotel = hotels.find((h) => h.id === hotelId);
        if (hotel) {
          const savedHotels: Hotel[] = JSON.parse(localStorage.getItem("savedHotels") || "[]");
          const hotelData: Hotel = {
            id: hotel.id,
            name: hotel.name,
            // prefer structured location fields if present
            address: hotel.address,
            image: hotel.imageUrl,
            price: hotel.price,
            amenities: hotel.amenities || [],
            description: `${hotel.roomType || "Room"} - Available: ${hotel.availability ?? "N/A"}`,
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
    localStorage.setItem("selectedHotel", JSON.stringify({ ...hotel, checkIn: checkInDate, checkOut: checkOutDate, guests: 1 }));
    redirect(`/booking/${hotel.id}`);
  };

  const handleViewMap = (hotel: Hotel) => setSelectedHotel(hotel);
  const handleCloseMap = () => setSelectedHotel(null);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "";
          if (city) {
            setInputValue(city);
          }
        } catch (err) {
          console.error("Reverse geocode failed for current location:", err);
        }
      },
      (err) => console.error(err)
    );
  };

  // Add-hotel dialog open state handled by `addOpen` and `setAddOpen`.

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Hero */}
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[#8FABD4]/40 bg-white/85 px-5 py-6 shadow-sm backdrop-blur dark:bg-zinc-900/90 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4A70A9] dark:text-[#8FABD4]">Find your stay</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#000000] dark:text-zinc-50 md:text-4xl">
              Explore Batangas!
            </h1>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-400">
              Where Every Stay Feels Right.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Check-in</span>
                <Input
                  type="date"
                  value={checkInDate}
                  min={DEFAULT_CHECK_IN}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="h-9 rounded-full border-[#8FABD4]/40 bg-white/90 text-[12px] dark:border-[#8FABD4]/60 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Check-out</span>
                <Input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate || DEFAULT_CHECK_OUT}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="h-9 rounded-full border-[#8FABD4]/40 bg-white/90 text-[12px] dark:border-[#8FABD4]/60 dark:bg-zinc-900"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Search bar and View Toggle */}
        <div className="sticky top-20 z-40 flex items-center gap-3 rounded-2xl bg-transparent shadow-sm backdrop-blur dark:bg-transparent">
          <div className="relative flex-1 w-1/3">
            <Input
              type="text"
              placeholder="Search by hotel, amenities, or price..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="rounded-full border-[#8FABD4]/50 bg-white/90 pr-20 text-sm dark:border-[#8FABD4]/60 dark:bg-zinc-900 dark:text-zinc-50"
            />
            {searchLoading && (
              <div className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#4A70A9] border-t-transparent animate-spin dark:border-[#8FABD4]"></div>
            )}
            <button
              onClick={handleUseCurrentLocation}
              title="Use my location"
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-[#4A70A9] hover:text-[#000000] dark:text-[#8FABD4] ${searchLoading ? "pointer-events-none opacity-50" : ""}`}
            >
              📍
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 ml-auto">
            <Button
              onClick={() => setViewMode("cards")}
              variant={viewMode === "cards" ? "default" : "outline"}
              className={viewMode === "cards"
                ? "rounded-full bg-[#4A70A9] px-4 py-2 text-xs font-medium text-white hover:bg-[#4A70A9]/90 dark:bg-[#8FABD4] dark:hover:bg-[#8FABD4]/90"
                : "rounded-full border-[#8FABD4]/60 bg-white/70 px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-white dark:border-[#8FABD4]/70 dark:bg-zinc-900 dark:text-zinc-100"}
            >
              🏨 Hotels
            </Button>
            <Button
              onClick={() => setViewMode("map")}
              variant={viewMode === "map" ? "default" : "outline"}
              className={viewMode === "map"
                ? "rounded-full bg-[#4A70A9] px-4 py-2 text-xs font-medium text-white hover:bg-[#4A70A9]/90 dark:bg-[#8FABD4] dark:hover:bg-[#8FABD4]/90"
                : "rounded-full border-[#8FABD4]/60 bg-white/70 px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-white dark:border-[#8FABD4]/70 dark:bg-zinc-900 dark:text-zinc-100"}
            >
              🗺️ Map
            </Button>
            {/* Add Hotel (submissions go to pending_hotels) */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full px-4 py-2 text-xs font-medium">Add Hotel</Button>
              </DialogTrigger>
              <DialogContent className="w-96 p-4">
                <DialogHeader>
                  <DialogTitle>Add Hotel</DialogTitle>
                </DialogHeader>

                <div>
                  <AddHotelForm />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Loading */}
        {hotels.length === 0 && loading && (
          <div className="flex flex-col items-center py-20">
            <div className="h-12 w-12 rounded-full border-4 border-[#4A70A9] border-dashed animate-spin dark:border-[#8FABD4]"></div>
            <p className="mt-4 text-sm font-medium text-[#4A70A9] dark:text-[#8FABD4]">Loading hotels...</p>
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
                  <Card className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#8FABD4]/40 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:border-[#8FABD4]/40 dark:bg-zinc-900">
                    <div className="relative h-44 w-full overflow-hidden bg-muted dark:bg-zinc-800">
                      <Image
                        src={hotel.imageUrl || `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(String(hotel.name || 'hotel'))}`}
                        alt={hotel.name || 'Hotel image'}
                        fill
                        className="object-cover transition duration-500 hover:scale-105"
                        unoptimized
                      />
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleFavorite(hotel.id)}
                        className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/80 text-[#4A70A9] shadow-sm hover:bg-white dark:bg-zinc-900/80 dark:text-[#EFECE3] dark:hover:bg-zinc-900"
                      >
                        <span className={favorites.includes(hotel.id) ? "text-lg" : "text-lg opacity-60"}>♥</span>
                      </Button>
                      {typeof hotel.price === "number" && hotel.price > 0 && (
                        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex gap-2 text-[11px] font-medium">
                          <span className="inline-flex items-baseline rounded-full bg-black/75 px-3 py-1 text-[#EFECE3] shadow-md dark:bg-black/70">
                            <span className="mr-1 text-[10px] uppercase tracking-wide opacity-80"></span>
                            <span className="text-sm">₱{hotel.price.toLocaleString()}</span>
                            <span className="ml-1 text-[10px] opacity-80">/night</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <CardContent className="flex flex-1 flex-col gap-2 p-4">
                      <div>
                        <h3 className="text-base font-semibold text-[#000000] dark:text-zinc-50">
                          {hotel.name}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {hotel.address}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex gap-0" aria-hidden>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span key={i} className={`text-sm ${i <= Math.round(hotel.rating ?? 0) ? 'text-yellow-400' : 'text-zinc-300'}`}>
                                ★
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{((hotel.reviewCount ?? 0) > 0 ? (hotel.rating ?? 5).toFixed(1) : '0.0')} · {hotel.reviewCount ?? 0} reviews</div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(hotel.amenities && hotel.amenities.length > 0
                          ? hotel.amenities.slice(0, 3)
                          : ["No amenities listed"]
                        ).map((a, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="border-[#8FABD4]/60 bg-[#8FABD4]/15 px-2 py-0 text-[11px] font-normal text-[#4A70A9] dark:border-[#8FABD4]/70 dark:bg-[#4A70A9]/25 dark:text-[#EFECE3]"
                          >
                            {a}
                          </Badge>
                        ))}
                        {hotel.availability !== undefined && hotel.availability > 0 && (
                          <Badge className="bg-[#4A70A9]/10 px-2 py-0 text-[11px] text-[#4A70A9] dark:bg-[#4A70A9]/30 dark:text-[#EFECE3]">
                            {hotel.availability} rooms left
                          </Badge>
                        )}
                      </div>

                      <div className="mt-auto flex items-end justify-between pt-3">
                        <div className="text-left text-xs text-zinc-600 dark:text-zinc-300">
                          {hotel.price && hotel.price > 0 ? (
                            <>
                              <div className="text-[13px] font-semibold text-[#000000] dark:text-zinc-50">
                                <span className="text-base">₱{hotel.price.toLocaleString()}</span>
                              </div>
                              <div className="text-[11px] text-[#4A70A9] dark:text-[#8FABD4]">
                                Includes taxes and charges
                              </div>
                            </>
                          ) : (
                            <span className="text-[11px] italic">Contact property for pricing</span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-[#8FABD4]/60 text-xs dark:border-[#8FABD4]/70 dark:text-zinc-100"
                            onClick={() => handleViewMap(hotel)}
                          >
                            Map
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-full bg-[#4A70A9] px-4 text-xs font-medium text-white hover:bg-[#4A70A9]/90 dark:bg-[#8FABD4] dark:text-zinc-950 dark:hover:bg-[#8FABD4]/90"
                            disabled={hotel.availability === 0 || userBookings.includes(hotel.id)}
                            onClick={() => handleBook(hotel)}
                          >
                            {userBookings.includes(hotel.id)
                              ? "Booked"
                              : hotel.availability === 0
                              ? "Fully booked"
                              : "Book now"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                  {filteredHotels.map((hotel) =>
                    hotel.latitude && hotel.longitude ? (
                      <Marker key={hotel.id} position={[hotel.latitude, hotel.longitude]}>
                        <Popup>
                          <div className="text-sm">
                            <h3 className="font-bold text-base mb-1">{hotel.name}</h3>
                            <p className="text-xs mb-2">{hotel.address}</p>
                            {hotel.price && (
                              <p className="text-xs font-semibold text-blue-600 mb-2">₱{hotel.price.toLocaleString()}</p>
                            )}
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex text-sm" aria-hidden>
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <span key={i} className={`${i <= Math.round(hotel.rating ?? 0) ? 'text-yellow-400' : 'text-zinc-300'}`}>★</span>
                                  ))}
                                </div>
                                <div className="text-xs text-zinc-600">{((hotel.reviewCount ?? 0) > 0 ? (hotel.rating ?? 5).toFixed(1) : '0.0')} · {hotel.reviewCount ?? 0} reviews</div>
                              </div>
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
                    ) : null
                  )}
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
                center={[selectedHotel.latitude || 13.7569, selectedHotel.longitude || 121.0583]}
                zoom={16}
                scrollWheelZoom
                style={{ width: "100%", height: "100%" }}
              >
                <AutoFitMap hotel={selectedHotel} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {selectedHotel.latitude && selectedHotel.longitude && (
                  <Marker position={[selectedHotel.latitude, selectedHotel.longitude]}>
                    <Popup>
                      <div>
                        <h3 className="font-bold">{selectedHotel.name}</h3>
                        <p>{selectedHotel.address}</p>
                        {selectedHotel.price && (
                          <p>₱{selectedHotel.price.toLocaleString()} / {selectedHotel.currency ?? "PHP"}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex text-sm" aria-hidden>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span key={i} className={`${i <= Math.round(selectedHotel.rating ?? 0) ? 'text-yellow-400' : 'text-zinc-300'}`}>★</span>
                            ))}
                          </div>
                          <div className="text-xs text-zinc-100 dark:text-zinc-300">{((selectedHotel.reviewCount ?? 0) > 0 ? (selectedHotel.rating ?? 5).toFixed(1) : '0.0')} · {selectedHotel.reviewCount ?? 0} reviews</div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
