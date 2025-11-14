"use client";

import { useAuth } from "@/lib/auth-context";
import { redirect, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
  Firestore,
  CollectionReference,
} from "firebase/firestore";
import app from "@/lib/firebase";

interface Hotel {
  id: string;
  name: string;
  location: string;
  description?: string;
  price?: number; // price per night
  imageUrl?: string;
  amenities?: string[];
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

export default function BookingPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const hotelId = params?.id as string;

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("12:00");
  const [guests, setGuests] = useState("1");
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const db: Firestore = getFirestore(app);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const minDate = `${yyyy}-${mm}-${dd}`;

  useEffect(() => {
    const hotelData = localStorage.getItem("selectedHotel");
    if (hotelData) {
      const parsed: Hotel = JSON.parse(hotelData);
      setHotel(parsed);
      setCheckInDate(parsed.checkIn || minDate);
      setCheckOutDate(parsed.checkOut || minDate);
      setGuests(parsed.guests?.toString() || "1");
    } else {
      setError("No hotel selected. Please go back and choose a hotel.");
    }
  }, [hotelId, minDate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) redirect("/");

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-4">{error}</h1>
          <Button onClick={() => redirect("/")} className="bg-blue-600 hover:bg-blue-700">
            Back to Hotels
          </Button>
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading hotel...</p>
      </div>
    );
  }

  // -----------------------
  // Calculate total hours
  // -----------------------
  const getTotalHours = () => {
    const inDate = new Date(`${checkInDate}T${checkInTime}`);
    const outDate = new Date(`${checkOutDate}T${checkOutTime}`);
    const diff = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60); // diff in hours
    return diff > 0 ? diff : 1; // at least 1 hour
  };

  const totalHours = getTotalHours();
  const pricePerHour = (hotel.price || 0) / 24; // assuming original price is per night (24h)
  const totalPrice = parseFloat((pricePerHour * totalHours).toFixed(2));

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const bookingsRef: CollectionReference = collection(db, "bookings");
      await addDoc(bookingsRef, {
        userId: user.uid,
        userEmail: user.email,
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelLocation: hotel.location,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        guests: Number(guests),
        pricePerHour,
        totalHours,
        totalPrice,
        createdAt: serverTimestamp(),
      });

      setBookingSubmitted(true);
    } catch (err: any) {
      console.error("Error saving booking:", err);
      alert("Failed to save booking. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div className="max-w-6xl mx-auto" initial="initial" animate="animate" variants={fadeInUp}>
        {!bookingSubmitted ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Hotel Details */}
            <motion.div className="lg:col-span-2" variants={fadeInUp} initial="initial" animate="animate">
              <Card>
                <div className="w-full h-80 overflow-hidden rounded-t-lg">
                  <img src={hotel.imageUrl || "/placeholder.jpg"} alt={hotel.name} className="w-full h-full object-cover" />
                </div>
                <CardHeader>
                  <CardTitle className="text-3xl">{hotel.name}</CardTitle>
                  <CardDescription>{hotel.location}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-zinc-600 dark:text-zinc-400">{hotel.description}</p>
                  {hotel.amenities?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 text-black dark:text-white">Amenities</h3>
                      <div className="flex flex-wrap gap-2">
                        {hotel.amenities.map((amenity, idx) => (
                          <Badge key={idx} variant="secondary">{amenity}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Booking Form */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>Complete Your Booking</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitBooking} className="space-y-4">
                    {/* Check-in */}
                    <div>
                      <Label className="text-black dark:text-white">Check-in</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="date"
                          value={checkInDate}
                          onChange={(e) => setCheckInDate(e.target.value)}
                          required
                          min={minDate}
                        />
                        <Input
                          type="time"
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Check-out */}
                    <div>
                      <Label className="text-black dark:text-white">Check-out</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="date"
                          value={checkOutDate}
                          onChange={(e) => setCheckOutDate(e.target.value)}
                          required
                          min={checkInDate}
                        />
                        <Input
                          type="time"
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Guests */}
                    <div>
                      <Label htmlFor="guests" className="text-black dark:text-white">Number of Guests</Label>
                      <Input
                        id="guests"
                        type="number"
                        min="1"
                        value={guests}
                        onChange={(e) => setGuests(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    {/* Price Summary */}
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-zinc-600 dark:text-zinc-400">Price per hour</span>
                        <span className="font-semibold text-black dark:text-white">${pricePerHour.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span className="text-black dark:text-white">Total ({totalHours.toFixed(2)} hours)</span>
                        <span className="text-black dark:text-white">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="lg" disabled={saving}>
                      {saving ? "Booking..." : "Confirm Booking"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        ) : (
          <motion.div className="max-w-md mx-auto text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="p-8">
              <div className="mb-4 text-5xl">✅</div>
              <CardTitle className="text-3xl mb-2">Booking Confirmed!</CardTitle>
              <CardDescription className="mb-6">
                Your reservation at {hotel.name} has been confirmed. Check your email for details.
              </CardDescription>
              <Button onClick={() => redirect("/dashboard")} className="bg-blue-600 hover:bg-blue-700 w-full">
                View Your Booking
              </Button>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
