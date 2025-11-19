"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getNearbyRecommendations, NearbyRecommendation } from "@/lib/ollama";
import { BookingModal } from "@/components/booking-modal";
import dynamic from "next/dynamic";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  FirestoreError,
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
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  availability?: number;
  amenities?: string[];
  description?: string;
}

export default function HotelDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const hotelId = params.id as string;

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [recommendations, setRecommendations] = useState<NearbyRecommendation[]>([]);
  const [loadingHotel, setLoadingHotel] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [isBooked, setIsBooked] = useState(false);

  // Load hotel data from localStorage or fetch
  useEffect(() => {
    const savedHotel = localStorage.getItem("selectedHotel");
    if (savedHotel) {
      const data = JSON.parse(savedHotel);
      setHotel(data);
      setCheckIn(data.checkIn || new Date().toISOString().split("T")[0]);
      setCheckOut(
        data.checkOut ||
          new Date(Date.now() + 86400000).toISOString().split("T")[0]
      );
      setLoadingHotel(false);
    }
  }, [hotelId]);

  // Fetch nearby recommendations from Ollama
  useEffect(() => {
    if (!hotel) return;

    const fetchRecommendations = async () => {
      setLoadingRecommendations(true);
      try {
        const result = await getNearbyRecommendations(
          hotel.latitude,
          hotel.longitude,
          hotel.name
        );
        setRecommendations(result.recommendations);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
      } finally {
        setLoadingRecommendations(false);
      }
    };

    fetchRecommendations();
  }, [hotel]);

  // Check if hotel is already booked
  useEffect(() => {
    if (!user?.email || !hotel) return;

    const db = getFirestore(app);
    const q = query(
      collection(db, "bookings"),
      where("userEmail", "==", user.email),
      where("hotelId", "==", hotel.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIsBooked(snapshot.docs.length > 0);
      },
      (error: FirestoreError) => {
        console.error("Error checking booking status:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.email, hotel]);

  if (loadingHotel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFECE3] dark:bg-zinc-950">
        <div className="h-12 w-12 rounded-full border-4 border-[#4A70A9] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#EFECE3] dark:bg-zinc-950">
        <p className="mb-4 text-xl text-zinc-700 dark:text-zinc-300">Hotel not found</p>
        <button
          onClick={() => router.back()}
          className="rounded-full bg-[#4A70A9] px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#4A70A9]/90"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <motion.div className="mx-auto max-w-6xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 rounded-full border border-[#8FABD4]/50 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-white dark:border-[#8FABD4]/60 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          ← Back
        </button>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="space-y-8 lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="h-96 overflow-hidden rounded-xl shadow-lg"
            >
              <img
                src={hotel.imageUrl}
                alt={hotel.name}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </motion.div>

            {/* Hotel Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 rounded-2xl border border-[#8FABD4]/40 bg-white/95 p-6 shadow-sm dark:border-[#8FABD4]/40 dark:bg-zinc-900/95"
            >
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-[#000000] dark:text-zinc-50">
            {hotel.name}
          </h1>
          <p className="mb-4 text-sm text-zinc-700 dark:text-zinc-400">{hotel.address}</p>

          {/* Availability & Price */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#8FABD4]/15 p-4">
              <p className="mb-1 text-xs text-zinc-700 dark:text-zinc-300">Price per night</p>
              <p className="text-2xl font-semibold text-[#4A70A9]">
                ₱{hotel.price?.toLocaleString() || "N/A"}
              </p>
            </div>
            <div className="rounded-xl bg-[#EFECE3] p-4 dark:bg-zinc-800/80">
              <p className="mb-1 text-xs text-zinc-700 dark:text-zinc-300">Availability</p>
              <p className="text-2xl font-semibold text-[#000000] dark:text-zinc-50">
                {hotel.availability || 0} rooms
              </p>
            </div>
            <div className="rounded-xl bg-[#4A70A9]/10 p-4 dark:bg-[#4A70A9]/30">
              <p className="mb-1 text-xs text-zinc-700 dark:text-zinc-200">Status</p>
              <p
                className={`text-2xl font-semibold ${
                  isBooked
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {isBooked ? "Booked" : "Available"}
              </p>
            </div>
          </div>

          {/* Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-[#000000] dark:text-zinc-50">Amenities</h2>
              <div className="flex flex-wrap gap-1.5">
                {hotel.amenities.map((amenity, idx) => (
                  <span
                    key={idx}
                    className="rounded-full border border-[#8FABD4]/60 bg-[#8FABD4]/15 px-3 py-1 text-xs font-medium text-[#4A70A9] dark:border-[#8FABD4]/70 dark:bg-[#4A70A9]/25 dark:text-[#EFECE3]"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Map */}
        {L && hotel.latitude && hotel.longitude && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="h-96 overflow-hidden rounded-xl shadow-md"
          >
            <MapContainer
              center={[hotel.latitude, hotel.longitude]}
              zoom={16}
              scrollWheelZoom
              style={{ width: "100%", height: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker position={[hotel.latitude, hotel.longitude]}>
                <Popup>
                  <div>
                    <h3 className="font-bold">{hotel.name}</h3>
                    <p className="text-sm">{hotel.address}</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </motion.div>
        )}

        {/* Nearby Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl bg-white p-6 shadow-md dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-2xl font-semibold text-[#000000] dark:text-zinc-50">
            Nearby Attractions & Dining
          </h2>
          {loadingRecommendations ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4A70A9] border-t-transparent"></div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-lg border border-[#8FABD4]/40 bg-white/95 shadow-sm transition hover:shadow-md dark:border-[#8FABD4]/40 dark:bg-zinc-900/95"
                >
                  <img
                    src={rec.imageUrl || "https://via.placeholder.com/400x300"}
                    alt={rec.name}
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="flex-1 text-sm font-semibold text-[#000000] dark:text-zinc-50">
                        {rec.name}
                      </h3>
                      <span className="ml-2 shrink-0 rounded-full bg-[#8FABD4]/20 px-2 py-1 text-xs font-medium text-[#4A70A9] dark:bg-[#4A70A9]/30 dark:text-[#EFECE3]">
                        {rec.type}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">{rec.description}</p>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">📍 {rec.distance}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              No recommendations available
            </p>
          )}
        </motion.div>
      </div>

      {/* Sidebar - Booking Summary */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="sticky top-8 h-fit rounded-2xl border border-[#8FABD4]/40 bg-white/95 p-6 shadow-md dark:border-[#8FABD4]/40 dark:bg-zinc-900/95"
      >
        <h2 className="text-xl font-semibold text-[#000000] dark:text-zinc-50">Booking Summary</h2>

        <div className="mt-4 space-y-3 border-b border-zinc-200 pb-4 dark:border-zinc-700">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Check In:</span>
            <span className="font-medium text-[#000000] dark:text-zinc-50">{checkIn}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Check Out:</span>
            <span className="font-medium text-[#000000] dark:text-zinc-50">{checkOut}</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[#8FABD4]/10 p-4 dark:bg-[#4A70A9]/20">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-200">Nightly Rate:</span>
            <span className="font-semibold text-[#000000] dark:text-zinc-50">
              ₱{hotel.price?.toLocaleString() || 0}
            </span>
          </div>
          <p className="text-right text-xs text-zinc-600 dark:text-zinc-400">+₱500 taxes & fees</p>
        </div>

        <button
          onClick={() => setIsBookingOpen(true)}
          disabled={!user || isBooked || hotel.availability === 0}
          className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold text-white shadow-sm transition ${
            !user || isBooked || hotel.availability === 0
              ? "cursor-not-allowed bg-zinc-400/70 opacity-70"
              : "bg-[#4A70A9] hover:bg-[#4A70A9]/90"
          }`}
        >
          {isBooked ? "✓ Already Booked" : hotel.availability === 0 ? "No Availability" : "Book Now"}
        </button>

        {!user && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
            ⚠️ Please sign in to book
          </div>
        )}
      </motion.div>
    </div>
  </motion.div>

      {/* Booking Modal */}
      <BookingModal
        hotel={hotel}
        checkIn={checkIn}
        checkOut={checkOut}
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onBook={() => setIsBooked(true)}
        onChangeDates={({ checkIn, checkOut }) => {
          setCheckIn(checkIn);
          setCheckOut(checkOut);
        }}
      />
    </div>
  );
}
