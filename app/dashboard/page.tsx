"use client";

import { useAuth } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations";
import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  FirestoreError,
  Timestamp,
} from "firebase/firestore";
import app from "@/lib/firebase";

interface Booking {
  id: string;
  hotelName: string;
  hotelLocation: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice: number;
  createdAt?: Timestamp;
}

export default function Dashboard() {
  const { user, loading } = useAuth();

  // -----------------------
  // State (always define hooks first!)
  // -----------------------
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const db = getFirestore(app);

  // -----------------------
  // Fetch bookings by userEmail safely inside useEffect
  // -----------------------
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
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];
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

  // -----------------------
  // Redirect / Loading (outside hooks, safe)
  // -----------------------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) redirect("/");

  // -----------------------
  // Render
  // -----------------------
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div className="mb-8" initial="initial" animate="animate" variants={fadeInUp}>
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Manage your bookings and profile</p>
        </motion.div>

        {/* Tabs */}
        <motion.div initial="initial" animate="animate" variants={fadeInUp} transition={{ delay: 0.2 }}>
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
              <TabsTrigger value="bookings">My Bookings</TabsTrigger>
              <TabsTrigger value="favorites">Saved Hotels</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            {/* Bookings Tab */}
            <TabsContent value="bookings" className="space-y-4">
              {loadingBookings ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-zinc-600 dark:text-zinc-400">Loading your bookings...</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : fetchError ? (
                <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Error Loading Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-red-600 dark:text-red-400">{fetchError}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                        Open your Firebase console and create the required index to fix this issue.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : bookings.length === 0 ? (
                <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                  <Card>
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
                </motion.div>
              ) : (
                <motion.div className="space-y-4" initial="initial" animate="animate" variants={staggerContainer}>
                  {bookings.map((booking) => (
                    <motion.div key={booking.id} variants={staggerItem}>
                      <Card>
                        <CardHeader>
                          <CardTitle>{booking.hotelName}</CardTitle>
                          <CardDescription>{booking.hotelLocation}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p>
                            <span className="font-semibold">Check-in:</span> {booking.checkInDate}
                          </p>
                          <p>
                            <span className="font-semibold">Check-out:</span> {booking.checkOutDate}
                          </p>
                          <p>
                            <span className="font-semibold">Guests:</span> {booking.guests}
                          </p>
                          <p>
                            <span className="font-semibold">Total Price:</span> ${booking.totalPrice}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="space-y-4">
              <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                <Card>
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
              </motion.div>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Your account details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <motion.div className="flex items-center space-x-4" variants={staggerContainer} initial="initial" animate="animate">
                      {user.photoURL && (
                        <motion.img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full" variants={staggerItem} />
                      )}
                      <motion.div variants={staggerItem}>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Display Name</p>
                        <p className="text-lg font-semibold text-black dark:text-white">{user.displayName || "Not set"}</p>
                      </motion.div>
                    </motion.div>

                    <motion.div variants={staggerItem} initial="initial" animate="animate">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Email Address</p>
                      <p className="text-base font-medium text-black dark:text-white">{user.email}</p>
                    </motion.div>

                    {user.phoneNumber && (
                      <motion.div variants={staggerItem} initial="initial" animate="animate">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Phone Number</p>
                        <p className="text-base font-medium text-black dark:text-white">{user.phoneNumber}</p>
                      </motion.div>
                    )}

                    <motion.div variants={staggerItem} initial="initial" animate="animate">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Account Status</p>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
