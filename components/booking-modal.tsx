"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import app from "@/lib/firebase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Users } from "lucide-react";

interface Hotel {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  availability?: number;
  imageUrl?: string;
}

interface BookingModalProps {
  hotel: Hotel;
  checkIn: string;
  checkOut: string;
  isOpen: boolean;
  onClose: () => void;
  onBook: () => void;
  onChangeDates: (next: { checkIn: string; checkOut: string }) => void;
}

export function BookingModal({ hotel, checkIn, checkOut, isOpen, onClose, onBook, onChangeDates }: BookingModalProps) {
  const { user } = useAuth();
  const [guests, setGuests] = useState(1);
  const [roomType, setRoomType] = useState("standard");
  const [isLoading, setIsLoading] = useState(false);

  const roomTypes = [
    { id: "standard", name: "Standard Room", price: 0 },
    { id: "deluxe", name: "Deluxe Room", price: 500 },
    { id: "suite", name: "Suite", price: 1500 },
  ];

  const selectedRoomType = roomTypes.find((rt) => rt.id === roomType);
  const basePrice = hotel.price || 0;
  const roomExtra = selectedRoomType?.price || 0;
  const nightsCount = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
  const totalPrice = (basePrice + roomExtra) * nightsCount;
  const today = new Date().toISOString().split("T")[0];

  const handleBook = async () => {
    if (!user) {
      toast.error("Please sign in to complete booking");
      return;
    }

    setIsLoading(true);
    try {
      const db = getFirestore(app);
      const bookingData = {
        hotelId: hotel.id,
        hotelName: hotel.name,
        userEmail: user.email,
        userId: user.uid,
        userName: user.displayName || "Guest",
        checkIn,
        checkOut,
        guests,
        roomType: selectedRoomType?.name,
        totalPrice,
        status: "confirmed",
        bookingDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        hotelCoordinates: {
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        },
      };

      await addDoc(collection(db, "bookings"), bookingData);
      
      toast.success(`Booking confirmed for ${hotel.name}!`);
      onBook();
      onClose();
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Failed to complete booking");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-xl px-4 sm:px-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="overflow-hidden rounded-2xl border bg-card/95 shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex flex-row items-center justify-between bg-linear-to-r from-[#4A70A9] to-[#8FABD4] py-4 pl-5 pr-4 text-white">
            <div>
              <CardTitle className="text-lg font-semibold sm:text-xl">Confirm your stay</CardTitle>
              <p className="mt-1 text-xs text-blue-100 sm:text-sm">
                Secure your booking at {hotel.name} in just a few clicks.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <span className="text-lg">×</span>
            </Button>
          </CardHeader>

          <CardContent className="space-y-5 p-5 sm:p-6">
            {/* Hotel + meta */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-semibold sm:text-lg">{hotel.name}</h3>
                <div className="flex items-center text-xs text-muted-foreground sm:text-sm">
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  <span>{hotel.address || "Batangas, Philippines"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-200">
                  Best value in the area
                </Badge>
              </div>
            </div>

            {/* Layout: left form / right summary */}
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Left: details form */}
              <div className="flex-1 space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Check-in
                    </label>
                    <input
                      type="date"
                      value={checkIn}
                      min={today}
                      onChange={(e) =>
                        onChangeDates({ checkIn: e.target.value, checkOut })
                      }
                      className="w-full rounded-lg border bg-muted px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Check-out
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      min={today}
                      onChange={(e) =>
                        onChangeDates({ checkIn, checkOut: e.target.value })
                      }
                      className="w-full rounded-lg border bg-muted px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    />
                  </div>
                </div>

                {/* Guests */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Guests
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(parseInt(e.target.value))}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Guest" : "Guests"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room Type */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground">Room type</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} {rt.price > 0 && `(+₱${rt.price})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auth notice */}
                {!user && (
                  <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-900/30 dark:text-yellow-100">
                    You must be signed in to confirm this booking.
                  </div>
                )}
              </div>

              {/* Right: image + price summary */}
              <div className="w-full max-w-xs space-y-3 rounded-xl border border-[#8FABD4]/40 bg-[#EFECE3] p-4 text-xs sm:text-[13px]">
                {hotel.imageUrl && (
                  <div className="mb-2 h-24 w-full overflow-hidden rounded-lg bg-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hotel.imageUrl}
                      alt={hotel.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#000000] dark:text-foreground">Price breakdown</span>
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[11px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-100">
                    {nightsCount} night{nightsCount > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Base ({nightsCount}×):</span>
                    <span>₱{(basePrice * nightsCount).toLocaleString()}</span>
                  </div>
                  {roomExtra > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Room upgrade:</span>
                      <span>₱{(roomExtra * nightsCount).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <p>Includes local taxes and fees · Free cancellation where applicable.</p>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3 text-[13px] font-semibold">
                  <span>Total for stay</span>
                  <span className="text-base">₱{totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={onClose}
              >
                Back to search
              </Button>
              <Button
                className="w-full bg-[#4A70A9] text-white hover:bg-[#4A70A9]/90 sm:w-auto"
                onClick={handleBook}
                disabled={!user || isLoading}
              >
                {isLoading ? "Processing..." : "Confirm booking"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
