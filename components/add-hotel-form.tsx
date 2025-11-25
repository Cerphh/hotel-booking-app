"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";
import { DialogClose } from "@/components/ui/dialog";
import MapDialogWrapper from "./map-dialog-wrapper";
import { MapPin } from "lucide-react";

interface Props {}

export default function AddHotelForm(_: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [roomsAvailable, setRoomsAvailable] = useState<number | "">("");
  const [image, setImage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [amenities, setAmenities] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lon: number } | null>(null);

  const closeRef = useRef<HTMLButtonElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !location) return alert("Please fill required fields");
    setLoading(true);
    try {
      const payload = {
        name,
        location,
        // attach coordinates if geocoded
        ...(geocodedCoords ? { lat: geocodedCoords.lat, lng: geocodedCoords.lon, latitude: geocodedCoords.lat, longitude: geocodedCoords.lon } : {}),
        price: Number(price) || 0,
        roomsAvailable: Number(roomsAvailable) || 0,
        image: image || "",
        amenities: amenities ? amenities.split(",").map((s) => s.trim()) : [],
        createdAt: new Date().toISOString(),
        ...(user?.email ? { submitterEmail: user.email } : {}),
      } as const;

      // Submit to the in-memory pending API (not persisted to Firestore)
      try {
        const res = await fetch(`/api/pending`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created = await res.json();

        // Notify admin UI that a pending hotel was added
        try {
          window.dispatchEvent(new CustomEvent("hotbook:pending-hotel-added", { detail: { id: created.id } }));
        } catch {
          // ignore
        }

        alert("Hotel submitted for review. An admin will verify it before it appears in the public list.");
      } catch (err) {
        console.error("Failed to submit pending hotel:", err);
        alert("Failed to submit pending hotel. See console for details.");
      }
      // Close dialog by clicking the DialogClose button
      if (closeRef.current) closeRef.current.click();

      // Reset form
      setName("");
      setLocation("");
      setGeocodedCoords(null);
      setPrice("");
      setRoomsAvailable("");
      setImage("");
      setAmenities("");
    } catch (err) {
      console.error("Failed to add hotel:", err);
      alert("Failed to add hotel. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const pinCurrentLocation = async () => {
    if (!navigator.geolocation) return alert("Geolocation is not available in this browser.");
    setPinLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGeocodedCoords({ lat, lon });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`);
          if (res.ok) {
            const j = await res.json();
            if (j?.display_name) setLocation(j.display_name);
          }
        } catch (err) {
          console.error("Reverse geocode failed:", err);
        } finally {
          setPinLoading(false);
        }
      },
      (err) => {
        console.error("Geolocation failed:", err);
        alert("Failed to get current location.");
        setPinLoading(false);
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2">
      <input
        required
        placeholder="Hotel name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <div className="relative">
        <input
          required
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full pr-10 px-3 py-2 border rounded"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button type="button" onClick={pinCurrentLocation} title="Pin my current location" aria-label="Pin my current location" className="p-1 text-zinc-600">
            <MapPin className={pinLoading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </button>

          {/* Controlled dialog so we can close it programmatically when a location is picked */}
          <MapDialogWrapper
            initial={geocodedCoords}
            onPick={async (c: { lat: number; lon: number }) => {
              setGeocodedCoords(c);
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(c.lat))}&lon=${encodeURIComponent(String(c.lon))}`);
                if (res.ok) {
                  const j = await res.json();
                  if (j?.display_name) setLocation(j.display_name);
                }
              } catch (e) {
                // ignore
              }
            }}
          />
        </div>
      </div>
      <input
        type="number"
        placeholder="Price (PHP)"
        value={price === "" ? "" : String(price)}
        onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full px-3 py-2 border rounded"
      />
        <input
          type="number"
          placeholder="Rooms available"
          value={roomsAvailable === "" ? "" : String(roomsAvailable)}
          onChange={(e) => setRoomsAvailable(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full px-3 py-2 border rounded"
        />
      <div className="flex items-center gap-2">
        <input
          placeholder="Image URL"
          value={image}
          onChange={(e) => {
            setImage(e.target.value);
            setImagePreview(e.target.value || null);
          }}
          className="flex-1 px-3 py-2 border rounded"
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!/^image\/(jpeg|jpg|png)$/.test(f.type)) {
                alert('Please upload a JPG or PNG image.');
                return;
              }
              const maxSize = 5 * 1024 * 1024; // 5MB
              if (f.size > maxSize) {
                alert('Please upload an image smaller than 5 MB.');
                return;
              }

              // Read file as data URL and set as image URL (preview)
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string | ArrayBuffer | null;
                if (typeof result === 'string') {
                  setImage(result);
                  setImagePreview(result);
                }
              };
              reader.readAsDataURL(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-[#EFECE3] rounded border text-sm hover:bg-[#E0DCCF]"
          >
            Upload
          </button>
        </div>
      </div>
      {imagePreview && (
        <div className="mt-2">
          <p className="text-xs text-zinc-600 mb-1">Preview</p>
          <div className="h-28 w-28 overflow-hidden rounded border bg-zinc-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
          </div>
        </div>
      )}
      <input
        placeholder="Amenities (comma separated)"
        value={amenities}
        onChange={(e) => setAmenities(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />

      <div className="flex items-center justify-end gap-2">
        <DialogClose asChild>
          <button ref={closeRef} className="hidden" />
        </DialogClose>
        <Button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Hotel"}
        </Button>
      </div>
    </form>
  );
}
