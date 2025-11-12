"use client";

import { useAuth } from "@/lib/auth-context";
import { MOCK_HOTELS } from "@/lib/hotels-data";
import { redirect, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BookingPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const hotelId = params?.id as string;

  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [guests, setGuests] = useState("1");
  const [bookingSubmitted, setBookingSubmitted] = useState(false);

  // Redirect to home if not authenticated
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    redirect("/");
  }

  // Find hotel
  const hotel = MOCK_HOTELS.find((h) => h.id === hotelId);

  if (!hotel) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-4">
            Hotel not found
          </h1>
          <Button onClick={() => redirect("/")} className="bg-blue-600 hover:bg-blue-700">
            Back to Hotels
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSubmitted(true);
    // In a real app, you'd send this to your backend
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial="initial"
        animate="animate"
        variants={fadeInUp}
      >
        {!bookingSubmitted ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Hotel Details */}
            <motion.div className="lg:col-span-2" variants={fadeInUp} initial="initial" animate="animate">
              <Card>
                <div className="w-full h-80 overflow-hidden rounded-t-lg">
                  <img
                    src={hotel.image}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-3xl">{hotel.name}</CardTitle>
                  <CardDescription>{hotel.location}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-zinc-600 dark:text-zinc-400">{hotel.description}</p>
                  <div>
                    <h3 className="font-semibold mb-2 text-black dark:text-white">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {hotel.amenities.map((amenity, idx) => (
                        <Badge key={idx} variant="secondary">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Booking Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>Complete Your Booking</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitBooking} className="space-y-4">
                    <div>
                      <Label htmlFor="checkin" className="text-black dark:text-white">
                        Check-in Date
                      </Label>
                      <Input
                        id="checkin"
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="checkout" className="text-black dark:text-white">
                        Check-out Date
                      </Label>
                      <Input
                        id="checkout"
                        type="date"
                        value={checkOutDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="guests" className="text-black dark:text-white">
                        Number of Guests
                      </Label>
                      <Input
                        id="guests"
                        type="number"
                        min="1"
                        value={guests}
                        onChange={(e) => setGuests(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-zinc-600 dark:text-zinc-400">Price per night</span>
                        <span className="font-semibold text-black dark:text-white">
                          ${hotel.price}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span className="text-black dark:text-white">Total</span>
                        <span className="text-black dark:text-white">
                          ${hotel.price * 3}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      Confirm Booking
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        ) : (
          /* Success Message */
          <motion.div
            className="max-w-md mx-auto text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="p-8">
              <div className="mb-4 text-5xl">✅</div>
              <CardTitle className="text-3xl mb-2">Booking Confirmed!</CardTitle>
              <CardDescription className="mb-6">
                Your reservation at {hotel.name} has been confirmed. Check your email for details.
              </CardDescription>
              <Button
                onClick={() => redirect("/dashboard")}
                className="bg-blue-600 hover:bg-blue-700 w-full"
              >
                View Your Booking
              </Button>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
