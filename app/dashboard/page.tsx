"use client"; // must be first

import { useAuth } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, User2 } from "lucide-react";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  FirestoreError,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import app from "@/lib/firebase";
import dynamic from "next/dynamic";
import { useMap } from "react-leaflet";

// Dynamic Leaflet imports
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  const _L = require("leaflet") as any;
  L = _L;
  if (_L?.Icon?.Default?.prototype) {
    try {
      // some leaflet typings don't expose _getIconUrl; guard at runtime
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete _L.Icon.Default.prototype._getIconUrl;
    } catch (e) {
      // ignore
    }
    _L.Icon.Default.mergeOptions({
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
  latitude?: number;
  longitude?: number;
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
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [editFormData, setEditFormData] = useState<{
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    roomType: string;
    totalPrice: number;
  } | null>(null);
  const [cancelConfirmBooking, setCancelConfirmBooking] = useState<Booking | null>(null);

  const db = getFirestore(app);

  // Fetch bookings from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setLoadingBookings(false);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // DEBUG: print current user email and raw snapshot docs to help diagnose missing bookings
        try {
          // eslint-disable-next-line no-console
          console.log("[DEBUG] Dashboard current user:", { email: user?.email, uid: user?.uid });
          // eslint-disable-next-line no-console
          console.log(
            "[DEBUG] Bookings snapshot raw:",
            snapshot.docs.map((d) => ({ id: d.id, data: d.data() }))
          );
        } catch (e) {
          // ignore
        }

        const data = snapshot.docs.map((d) => {
          const raw = d.data() as any;
          // Normalize booking fields from different writers/components
          const booking: Booking = {
            id: d.id,
            hotelName: raw.hotelName || raw.hotel?.name || raw.hotel?.hotelName || raw.name || "Unknown Hotel",
            hotelLocation:
              raw.hotelLocation || raw.hotel?.location || raw.hotel?.address || raw.address || "",
            checkInDate: raw.checkIn || raw.checkInDate || raw.checkInDateISO || "",
            checkOutDate: raw.checkOut || raw.checkOutDate || raw.checkOutDateISO || "",
            guests: raw.guests || raw.partySize || 1,
            totalPrice: raw.totalPrice || raw.price || 0,
            hotelImage: raw.hotelImage || raw.image || raw.hotel?.imageUrl,
            lat: raw.hotelCoordinates?.latitude || raw.lat || raw.latitude,
            lon: raw.hotelCoordinates?.longitude || raw.lon || raw.longitude,
            createdAt: (raw.createdAt as any) || (raw.bookingDate ? Timestamp.fromDate(new Date(raw.bookingDate)) : undefined),
            roomType: raw.roomType || raw.roomTypeName,
            availability: raw.availability,
            price: raw.price,
          } as Booking;

          return booking;
        });

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
  }, [user?.uid, db]);

  // Load favorites from localStorage
  useEffect(() => {
    setLoadingFavorites(true);
    const saved = localStorage.getItem("savedHotels");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to parse saved hotels:", error);
        setFavorites([]);
      }
    }
    setLoadingFavorites(false);
  }, []);

  const removeFavorite = (hotelId: string) => {
    const updated = favorites.filter((h) => h.id !== hotelId);
    setFavorites(updated);
    localStorage.setItem("savedHotels", JSON.stringify(updated));
    
    // Also remove from favorites IDs list in hotels page
    const favoriteIds: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
    const updatedIds = favoriteIds.filter((id) => id !== hotelId);
    localStorage.setItem("favorites", JSON.stringify(updatedIds));
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

  // Initialize edit form when editBooking is opened
  useEffect(() => {
    if (editBooking) {
      setEditFormData({
        checkInDate: editBooking.checkInDate,
        checkOutDate: editBooking.checkOutDate,
        guests: editBooking.guests,
        roomType: editBooking.roomType || "Standard",
        totalPrice: editBooking.totalPrice,
      });
    }
  }, [editBooking]);

  // Calculate price based on nights
  const calculatePrice = (checkIn: string, checkOut: string, basePrice: number) => {
    if (!checkIn || !checkOut) return basePrice;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return basePrice;
    // Assuming the original price is per night
    const pricePerNight = (editBooking?.totalPrice || basePrice) / 
      (editBooking ? Math.ceil((new Date(editBooking.checkOutDate).getTime() - new Date(editBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)) : 1);
    return Math.round(pricePerNight * nights);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) redirect("/");

  const upcomingBooking = bookings[0];

  return (
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Header / hero */}
        <motion.div
          className="flex flex-col justify-between gap-4 rounded-3xl border border-[#8FABD4]/40 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-[#8FABD4]/40 dark:bg-zinc-900/90 md:flex-row md:items-center"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#4A70A9] dark:text-[#8FABD4]">My travel</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#000000] dark:text-zinc-50 md:text-4xl">
              Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-400">
              View upcoming stays, manage your bookings, and keep your favourite hotels in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3 md:text-sm">
            <Card className="border-none bg-[#8FABD4]/25 px-3 py-3 shadow-none dark:bg-[#4A70A9]/40">
              <CardHeader className="p-0 pb-1">
                <CardTitle className="text-[11px] font-medium text-[#4A70A9] dark:text-[#EFECE3]">
                  Upcoming stay
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-[13px] font-semibold text-[#000000] dark:text-[#EFECE3]">
                {upcomingBooking ? upcomingBooking.hotelName : "No trips yet"}
              </CardContent>
            </Card>

            <Card className="border-none bg-[#EFECE3] px-3 py-3 shadow-none dark:bg-[#4A70A9]">
              <CardHeader className="p-0 pb-1">
                <CardTitle className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  Total bookings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-[20px] font-semibold text-[#000000] dark:text-zinc-50">
                {bookings.length}
              </CardContent>
            </Card>

            <Card className="col-span-2 border-none bg-[#4A70A9]/10 px-3 py-3 shadow-none dark:bg-[#4A70A9]/35 md:col-span-1">
              <CardHeader className="p-0 pb-1">
                <CardTitle className="text-[11px] font-medium text-[#4A70A9] dark:text-[#EFECE3]">
                  Saved hotels
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-[20px] font-semibold text-[#4A70A9] dark:text-[#EFECE3]">
                {favorites.length}
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial="initial" animate="animate" variants={fadeInUp} transition={{ delay: 0.1 }}>
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="mb-6 grid w-full max-w-md grid-cols-3 gap-2 rounded-full bg-[#EFECE3] p-1 dark:bg-zinc-900/80">
              <TabsTrigger value="bookings" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-white data-[state=active]:text-[#000000]
                  dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                My Bookings
              </TabsTrigger>
              <TabsTrigger value="favorites" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-white data-[state=active]:text-[#000000]
                  dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                Saved Hotels
              </TabsTrigger>
              <TabsTrigger value="profile" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-white data-[state=active]:text-[#000000]
                  dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white
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
                <Card className="border border-dashed border-zinc-300 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/70">
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
                <motion.div
                  className="space-y-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {bookings.map((booking) => (
                    <motion.div key={booking.id} variants={staggerItem}>
                      <Card className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base font-semibold md:text-lg">
                                {booking.hotelName}
                              </CardTitle>
                              <Badge variant="outline" className="text-[11px]">
                                {booking.roomType || "Standard room"}
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center text-xs text-zinc-500 dark:text-zinc-400">
                              <MapPin className="mr-1.5 h-3.5 w-3.5" />
                              <span className="line-clamp-1">
                                {booking.hotelLocation || "Batangas, Philippines"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300 md:mt-0 md:w-64">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>
                                {booking.checkInDate} → {booking.checkOutDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User2 className="h-3.5 w-3.5" />
                              <span>{booking.guests} guest{booking.guests > 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 md:min-w-[220px]">
                          <div className="text-right text-xs text-zinc-600 dark:text-zinc-300">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Total</p>
                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                              ₱{booking.totalPrice.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInfoBooking(booking)}
                            >
                              Info
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMapBooking(booking)}
                            >
                              Map
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditBooking(booking)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setCancelConfirmBooking(booking)}
                            >
                              Cancel
                            </Button>
                          </div>
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
                <Card className="border border-dashed border-[#8FABD4]/60 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-[#000000] dark:text-zinc-50">Saved Hotels</CardTitle>
                    <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400">
                      Your favourite places to stay, all in one place.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="py-10 text-center">
                      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">No saved hotels yet</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Tap the heart on any hotel to keep it here for later.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="initial" animate="animate">
                  {favorites.map((hotel) => (
                    <motion.div key={hotel.id} variants={staggerItem}>
                      <Card className="flex h-full flex-col overflow-hidden rounded-xl border border-[#8FABD4]/40 bg-white/90 shadow-sm dark:border-[#8FABD4]/40 dark:bg-zinc-900/90">
                        <div className="h-32 w-full overflow-hidden">
                          <img
                            src={hotel.image || "/placeholder.jpg"}
                            alt={hotel.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-[#000000] dark:text-zinc-50">
                            {hotel.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400">
                            {hotel.location}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {hotel.description && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{hotel.description}</p>
                          )}
                          {hotel.amenities && hotel.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {hotel.amenities.map((amenity, idx) => (
                                <Badge key={idx} variant="outline" className="border-[#8FABD4]/50 bg-[#8FABD4]/10 px-2 py-0 text-[10px] font-normal text-[#4A70A9] dark:border-[#8FABD4]/70 dark:bg-[#4A70A9]/25 dark:text-[#EFECE3]">
                                  {amenity}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {hotel.price
                              ? `₱${hotel.price.toLocaleString()} per night`
                              : "Price not available"}
                          </p>
                          <div className="flex items-center justify-between pt-3">
                            <button
                              onClick={() => {
                                if (hotel.latitude && hotel.longitude) {
                                  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${hotel.latitude}&lon=${hotel.longitude}&format=json`;
                                  setMapBooking({
                                    id: hotel.id,
                                    hotelName: hotel.name,
                                    hotelLocation: hotel.location,
                                    checkInDate: new Date().toISOString().split('T')[0],
                                    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                                    guests: 2,
                                    totalPrice: hotel.price || 0,
                                    lat: hotel.latitude,
                                    lon: hotel.longitude,
                                  });
                                  setMapCoords({ lat: hotel.latitude, lon: hotel.longitude });
                                  setMapAddress(hotel.location);
                                }
                              }}
                              className="rounded-full bg-[#EFECE3] px-3 py-1 text-[11px] text-zinc-800 hover:bg-[#E0DCCF] dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            >
                              View Map
                            </button>
                            <div className="flex gap-2">
                              <button
                                onClick={() => removeFavorite(hotel.id)}
                                className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => {
                                  // Navigate to booking page with hotel details
                                  // For now, just alert
                                  alert(`Book ${hotel.name} - Feature coming soon`);
                                }}
                                className="rounded-full bg-[#4A70A9] px-4 py-1 text-[11px] font-medium text-white hover:bg-[#4A70A9]/90"
                              >
                                Book
                              </button>
                            </div>
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
          <DialogContent className="max-w-3xl" showCloseButton={false}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{infoBooking?.hotelName}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{infoBooking?.hotelLocation}</p>
              </div>
              <div>
                <button
                  onClick={() => setInfoBooking(null)}
                  aria-label="Close booking info"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>
            </div>

            {infoBooking && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <div className="h-40 w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    {infoBooking.hotelImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={infoBooking.hotelImage} alt={infoBooking.hotelName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-sm text-zinc-500">No image available</div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm text-zinc-500">Check-in</p>
                      <p className="font-medium">{infoBooking.checkInDate} {infoBooking.checkInTime || ""}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Check-out</p>
                      <p className="font-medium">{infoBooking.checkOutDate} {infoBooking.checkOutTime || ""}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-sm text-zinc-500">Guests</p>
                      <p className="font-medium">{infoBooking.guests}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Room</p>
                      <p className="font-medium">{infoBooking.roomType || "Standard"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Total</p>
                      <p className="font-medium">₱{infoBooking.totalPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  {infoBooking.amenities && infoBooking.amenities.length > 0 && (
                    <div>
                      <p className="text-sm text-zinc-500 mb-2">Amenities</p>
                      <div className="flex flex-wrap gap-2">
                        {infoBooking.amenities.map((a, i) => (
                          <Badge key={i} variant="secondary">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* single top-close 'x' is used; no bottom Close button */}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Map Modal */}
        {mapBooking && L && mapCoords && (
          <Dialog open={!!mapBooking && !!mapCoords} onOpenChange={() => setMapBooking(null)}>
            <DialogContent className="max-w-4xl p-0" showCloseButton={false}>
              <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-zinc-900">
                <div>
                  <h3 className="text-lg font-semibold">{mapBooking.hotelName}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{mapAddress}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapCoords.lat},${mapCoords.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Open in Maps
                  </a>
                  <button onClick={() => setMapBooking(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">x</button>
                </div>
              </div>

              <div className="h-[480px] w-full">
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
                        <h3 className="font-semibold">{mapBooking.hotelName}</h3>
                        <p className="text-sm text-zinc-500">{mapAddress}</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t bg-white dark:bg-zinc-900">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${mapCoords.lat},${mapCoords.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Directions
                </a>
                {/* single top-close 'x' is used; no bottom Close button */}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Booking Modal */}
        {editBooking && editFormData && (
          <Dialog open={!!editBooking} onOpenChange={() => setEditBooking(null)}>
            <DialogContent className="max-w-2xl" showCloseButton={false}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Update Booking</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{editBooking.hotelName}</p>
                </div>
                <button
                  onClick={() => setEditBooking(null)}
                  aria-label="Close edit modal"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="space-y-4 mt-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Check-in Date</label>
                    <input
                      type="date"
                      value={editFormData.checkInDate}
                      onChange={(e) => {
                        const newFormData = { ...editFormData, checkInDate: e.target.value };
                        setEditFormData(newFormData);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Check-out Date</label>
                    <input
                      type="date"
                      value={editFormData.checkOutDate}
                      onChange={(e) => {
                        const newFormData = { ...editFormData, checkOutDate: e.target.value };
                        setEditFormData(newFormData);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Number of Guests</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.guests}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, guests: parseInt(e.target.value) || editFormData.guests });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Room Type</label>
                    <input
                      type="text"
                      value={editFormData.roomType}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, roomType: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Total Price (₱) - Auto-calculated</label>
                  <input
                    type="number"
                    disabled
                    value={calculatePrice(editFormData.checkInDate, editFormData.checkOutDate, editBooking?.price || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-gray-100 dark:bg-zinc-700 text-black dark:text-white cursor-not-allowed opacity-60"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Price updates automatically based on check-in and check-out dates</p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditBooking(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={async () => {
                      try {
                        const calculatedPrice = calculatePrice(editFormData.checkInDate, editFormData.checkOutDate, editBooking?.price || 0);
                        const bookingRef = doc(db, "bookings", editBooking.id);
                        await updateDoc(bookingRef, {
                          checkInDate: editFormData.checkInDate,
                          checkOutDate: editFormData.checkOutDate,
                          guests: editFormData.guests,
                          roomType: editFormData.roomType,
                          totalPrice: calculatedPrice,
                        });
                        setEditBooking(null);
                        setEditFormData(null);
                      } catch (error) {
                        console.error("Error updating booking:", error);
                        alert("Failed to update booking. Please try again.");
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Cancel Booking Confirmation Modal */}
        {cancelConfirmBooking && (
          <Dialog open={!!cancelConfirmBooking} onOpenChange={() => setCancelConfirmBooking(null)}>
            <DialogContent className="max-w-md" showCloseButton={false}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Cancel Booking?</h3>
                </div>
                <button
                  onClick={() => setCancelConfirmBooking(null)}
                  aria-label="Close confirmation"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Are you sure you want to cancel your booking for <strong>{cancelConfirmBooking.hotelName}</strong>?
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Check-in: {cancelConfirmBooking.checkInDate} | Check-out: {cancelConfirmBooking.checkOutDate}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </p>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setCancelConfirmBooking(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Keep Booking
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const bookingRef = doc(db, "bookings", cancelConfirmBooking.id);
                        await deleteDoc(bookingRef);
                        setCancelConfirmBooking(null);
                      } catch (error) {
                        console.error("Error cancelling booking:", error);
                        alert("Failed to cancel booking. Please try again.");
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Confirm Cancel
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
