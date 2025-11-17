"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import app from "@/lib/firebase";
import { motion } from "framer-motion";
import { toast } from "sonner";

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
}

export function BookingModal({ hotel, checkIn, checkOut, isOpen, onClose, onBook }: BookingModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-96 max-h-96 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">Complete Your Booking</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold hover:opacity-80 transition"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Hotel Info */}
          <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-4">
            <h3 className="font-bold text-lg">{hotel.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{hotel.address}</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Check In</label>
              <input
                type="date"
                value={checkIn}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-zinc-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check Out</label>
              <input
                type="date"
                value={checkOut}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-zinc-800 text-sm"
              />
            </div>
          </div>

          {/* Guests */}
          <div>
            <label className="block text-sm font-medium mb-2">Number of Guests</label>
            <select
              value={guests}
              onChange={(e) => setGuests(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "Guest" : "Guests"}
                </option>
              ))}
            </select>
          </div>

          {/* Room Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Room Type</label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-sm"
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} {rt.price > 0 && `(+₱${rt.price})`}
                </option>
              ))}
            </select>
          </div>

          {/* Price Breakdown */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Base Price ({nightsCount} night{nightsCount > 1 ? "s" : ""}):</span>
              <span>₱{(basePrice * nightsCount).toLocaleString()}</span>
            </div>
            {roomExtra > 0 && (
              <div className="flex justify-between">
                <span>Room Type Premium:</span>
                <span>₱{(roomExtra * nightsCount).toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-blue-200 dark:border-blue-800 pt-2 flex justify-between font-bold text-base">
              <span>Total:</span>
              <span>₱{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          {/* Auth Check */}
          {!user && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ You must be logged in to complete this booking.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleBook}
              disabled={!user || isLoading}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition ${
                !user || isLoading
                  ? "bg-gray-400 cursor-not-allowed opacity-60"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading ? "Processing..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
