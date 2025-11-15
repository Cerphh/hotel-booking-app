"use client"; // must be first

import { useAuth } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  FirestoreError,
  Timestamp,
} from "firebase/firestore";
import app from "@/lib/firebase";
import dynamic from "next/dynamic";
import { useMap } from "react-leaflet";

// Dynamic Leaflet imports
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

interface Booking {
  id: string;
  hotelName: string;
  hotelLocation: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  guests: number;
  totalPrice: number;
  hotelImage?: string;
  lat?: number;
  lon?: number;
  createdAt?: Timestamp;
  amenities?: string[];
  roomType?: string;
  availability?: number;
  price?: number;
}

interface Hotel {
  id: string;
  name: string;
  location: string;
  description?: string;
  price?: number;
  image?: string;
  amenities?: string[];
}

// Helper to reverse geocode
async function getExactAddress(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    );
    const data = await res.json();
    const addr = data.address;
    const parts = [
      addr.suburb || addr.neighbourhood || addr.village || addr.hamlet,
      addr.city || addr.town || addr.municipality || addr.village,
      "Batangas",
    ].filter(Boolean);
    return parts.join(", ");
  } catch (err) {
    console.error("Reverse geocode failed:", err);
    return "Batangas, Philippines";
  }
}

// AutoFitMap component to center map on coords
function AutoFitMap({ coords }: { coords: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    if (map && coords) {
      map.setView([coords.lat, coords.lon], 15, { animate: true });
      setTimeout(() => {
        map.invalidateSize(); // ensures marker renders correctly
      }, 100);
    }
  }, [map, coords]);
  return null;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<Hotel[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  const [infoBooking, setInfoBooking] = useState<Booking | null>(null);
  const [mapBooking, setMapBooking] = useState<Booking | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [mapAddress, setMapAddress] = useState<string>("");

  const db = getFirestore(app);

  // Fetch bookings from Firestore
  useEffect(() => {
    if (!user?.email) {
      setLoadingBookings(false);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("userEmail", "==", user.email),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Booking[];
        setBookings(data);
        setLoadingBookings(false);
      },
      (error: FirestoreError) => {
        console.error("Firestore snapshot error:", error);
        setLoadingBookings(false);
        if (error.code === "failed-precondition") {
          setFetchError(
            "Firestore index required for this query is missing. Please create it in Firebase console."
          );
        } else {
          setFetchError("Failed to fetch bookings. Please try again later.");
        }
      }
    );

    return () => unsubscribe();
  }, [user?.email, db]);

  // Load favorites from localStorage
  useEffect(() => {
    setLoadingFavorites(true);
    const saved = localStorage.getItem("favorites");
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
    setLoadingFavorites(false);
  }, []);

  const removeFavorite = (hotelId: string) => {
    const updated = favorites.filter((h) => h.id !== hotelId);
    setFavorites(updated);
    localStorage.setItem("favorites", JSON.stringify(updated));
  };

  // Fetch coordinates for map modal
  useEffect(() => {
    if (!mapBooking) return;

    const fetchCoords = async () => {
      if (mapBooking.lat && mapBooking.lon) {
        setMapCoords({ lat: mapBooking.lat, lon: mapBooking.lon });
        setMapAddress(mapBooking.hotelLocation);
      } else if (mapBooking.hotelLocation) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              mapBooking.hotelLocation
            )}`
          );
          const data = await res.json();
          if (data.length > 0) {
            setMapCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
            const address = await getExactAddress(parseFloat(data[0].lat), parseFloat(data[0].lon));
            setMapAddress(address);
          } else {
            setMapCoords(null);
            setMapAddress(mapBooking.hotelLocation);
          }
        } catch (err) {
          console.error(err);
          setMapCoords(null);
          setMapAddress(mapBooking.hotelLocation);
        }
      }
    };

    fetchCoords();
  }, [mapBooking]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div className="mb-8" initial="initial" animate="animate" variants={fadeInUp}>
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Manage your bookings and profile</p>
        </motion.div>

        {/* Tabs */}
        <motion.div initial="initial" animate="animate" variants={fadeInUp} transition={{ delay: 0.2 }}>
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-8 gap-2">
              <TabsTrigger value="bookings" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-blue-600 data-[state=active]:text-white
                  dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                My Bookings
              </TabsTrigger>
              <TabsTrigger value="favorites" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-blue-600 data-[state=active]:text-white
                  dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                Saved Hotels
              </TabsTrigger>
              <TabsTrigger value="profile" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-blue-600 data-[state=active]:text-white
                  dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                Profile
              </TabsTrigger>
            </TabsList>

            {/* Bookings Tab */}
            <TabsContent value="bookings" className="space-y-4">
              {loadingBookings ? (
                <div className="flex justify-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
                </div>
              ) : fetchError ? (
                <Card className="border-2 border-gray-200 dark:border-zinc-700">
                  <CardHeader>
                    <CardTitle>Error Loading Bookings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-600 dark:text-red-400">{fetchError}</p>
                  </CardContent>
                </Card>
              ) : bookings.length === 0 ? (
                <Card className="border border-black">
                  <CardHeader>
                    <CardTitle>My Bookings</CardTitle>
                    <CardDescription>View and manage your hotel reservations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">No bookings yet</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500">
                        Start exploring hotels and make your first booking
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <motion.div className="space-y-2" variants={staggerContainer} initial="initial" animate="animate">
                  {bookings.map((booking) => (
                    <motion.div key={booking.id} variants={staggerItem}>
                      <Card className="flex flex-row items-center justify-between border border-black p-4">
                        <div className="flex-1">
                          <CardTitle>{booking.hotelName}</CardTitle>
                          <CardDescription>{booking.hotelLocation}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setInfoBooking(booking)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Info
                          </button>
                          <button
                            onClick={() => setMapBooking(booking)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            View Map
                          </button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="space-y-4">
              {loadingFavorites ? (
                <div className="flex justify-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
                </div>
              ) : favorites.length === 0 ? (
                <Card className="border border-black">
                  <CardHeader>
                    <CardTitle>Saved Hotels</CardTitle>
                    <CardDescription>Your favorite hotels for quick access</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">No saved hotels yet</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500">Favorite hotels will appear here</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={staggerContainer} initial="initial" animate="animate">
                  {favorites.map((hotel) => (
                    <motion.div key={hotel.id} variants={staggerItem}>
                      <Card className="flex flex-col border border-black">
                        <div className="h-48 w-full overflow-hidden rounded-t-lg">
                          <img src={hotel.image || "/placeholder.jpg"} alt={hotel.name} className="w-full h-full object-cover" />
                        </div>
                        <CardHeader>
                          <CardTitle>{hotel.name}</CardTitle>
                          <CardDescription>{hotel.location}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {hotel.description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{hotel.description}</p>}
                          {hotel.amenities && hotel.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {hotel.amenities.map((amenity, idx) => (
                                <Badge key={idx} variant="secondary">{amenity}</Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">Price: {hotel.price ? `$${hotel.price}` : "N/A"}</p>
                          <div className="flex justify-end">
                            <button
                              onClick={() => removeFavorite(hotel.id)}
                              className="px-3 py-1 text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                            >
                              Remove
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                <Card className="border border-black">
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Your account details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {user.photoURL && (
                      <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full" />
                    )}
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Display Name</p>
                      <p className="text-lg font-semibold text-black dark:text-white">{user.displayName || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Email Address</p>
                      <p className="text-base font-medium text-black dark:text-white">{user.email}</p>
                    </div>
                    {user.phoneNumber && (
                      <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Phone Number</p>
                        <p className="text-base font-medium text-black dark:text-white">{user.phoneNumber}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Account Status</p>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Info Modal */}
        <Dialog open={!!infoBooking} onOpenChange={() => setInfoBooking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{infoBooking?.hotelName}</DialogTitle>
            </DialogHeader>
            {infoBooking && (
              <div className="space-y-2">
                <p><strong>Location:</strong> {infoBooking.hotelLocation}</p>
                <p><strong>Check-in:</strong> {infoBooking.checkInDate} {infoBooking.checkInTime || ""}</p>
                <p><strong>Check-out:</strong> {infoBooking.checkOutDate} {infoBooking.checkOutTime || ""}</p>
                <p><strong>Guests:</strong> {infoBooking.guests}</p>
                <p><strong>Total Price:</strong> ₱{infoBooking.totalPrice.toLocaleString()}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Map Modal */}
        {mapBooking && L && mapCoords && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden w-full max-w-3xl"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <div className="p-4 flex justify-between border-b">
                <h2 className="text-xl font-semibold">{mapBooking.hotelName}</h2>
                <button onClick={() => setMapBooking(null)}>✕</button>
              </div>
              <div className="h-[400px] w-full">
                <MapContainer
                  center={[mapCoords.lat, mapCoords.lon]}
                  zoom={15}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <AutoFitMap coords={mapCoords} />
                  <Marker position={[mapCoords.lat, mapCoords.lon]}>
                    <Popup>
                      <div>
                        <h3>{mapBooking.hotelName}</h3>
                        <p>{mapAddress}</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
