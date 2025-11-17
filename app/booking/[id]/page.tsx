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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-xl text-gray-600 mb-4">Hotel not found</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8 px-4 sm:px-6 lg:px-8">
      <motion.div className="max-w-6xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
        >
          ← Back
        </button>

        {/* Hotel Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hotel Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl overflow-hidden shadow-lg h-96"
            >
              <img
                src={hotel.imageUrl}
                alt={hotel.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </motion.div>

            {/* Hotel Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-md"
            >
              <h1 className="text-4xl font-bold mb-2">{hotel.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">{hotel.address}</p>

              {/* Availability & Price */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Price per Night</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ₱{hotel.price?.toLocaleString() || "N/A"}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Availability</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {hotel.availability || 0} rooms
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                  <p className={`text-2xl font-bold ${isBooked ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {isBooked ? "Booked" : "Available"}
                  </p>
                </div>
              </div>

              {/* Amenities */}
              {hotel.amenities && hotel.amenities.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-3">Amenities</h2>
                  <div className="flex flex-wrap gap-2">
                    {hotel.amenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
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
                className="rounded-xl overflow-hidden shadow-md h-96"
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
              className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-md"
            >
              <h2 className="text-2xl font-bold mb-4">Nearby Attractions & Dining</h2>
              {loadingRecommendations ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
                    >
                      <img
                        src={rec.imageUrl || "https://via.placeholder.com/400x300"}
                        alt={rec.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-sm flex-1">{rec.name}</h3>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full ml-2 shrink-0">
                            {rec.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{rec.description}</p>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-500">📍 {rec.distance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">No recommendations available</p>
              )}
            </motion.div>
          </div>

          {/* Sidebar - Booking Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1 sticky top-8 h-fit"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-lg space-y-4">
              <h2 className="text-xl font-bold">Booking Summary</h2>

              <div className="space-y-3 border-b border-gray-200 dark:border-gray-700 pb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Check In:</span>
                  <span className="font-medium">{checkIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Check Out:</span>
                  <span className="font-medium">{checkOut}</span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span>Nightly Rate:</span>
                  <span className="font-bold">₱{hotel.price?.toLocaleString() || 0}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 text-right">+₱500 taxes & fees</p>
              </div>

              <button
                onClick={() => setIsBookingOpen(true)}
                disabled={!user || isBooked || hotel.availability === 0}
                className={`w-full px-4 py-3 rounded-lg font-bold text-white transition ${
                  !user || isBooked || hotel.availability === 0
                    ? "bg-gray-400 cursor-not-allowed opacity-60"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isBooked ? "✓ Already Booked" : hotel.availability === 0 ? "No Availability" : "Book Now"}
              </button>

              {!user && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Please sign in to book
                </div>
              )}
            </div>
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
      />
    </div>
  );
}
