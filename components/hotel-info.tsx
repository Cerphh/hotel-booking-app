"use client";

import React, { useEffect, useState } from "react";
import MapDialogWrapper from "./map-dialog-wrapper";
import { Button } from "./ui/button";
import { MapPin } from "lucide-react";
// MapPinPicker is used via MapDialogWrapper
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import app from "@/lib/firebase";

interface HotelItem {
  id?: string;
  [key: string]: any;
}

export default function HotelInfo({ hotel }: { hotel: HotelItem }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [reverseWords, setReverseWords] = useState<string[] | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [amenitiesInput, setAmenitiesInput] = useState("");
  const [roomsInput, setRoomsInput] = useState<number | "">("");
  const [priceInput, setPriceInput] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!hotel || !hotel.id) {
        setData(hotel || null);
        return;
      }
      setLoading(true);
      try {
        const db = getFirestore(app);
        const dref = doc(db, "hotels", hotel.id);
        const snap = await getDoc(dref);
        if (!mounted) return;
        if (snap.exists()) {
          setData({ id: snap.id, ...(snap.data() as Record<string, any>) });
        } else {
          // fallback to passed hotel
          setData(hotel);
        }
      } catch (err) {
        console.error("Failed to load hotel info:", err);
        setData(hotel);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [hotel]);

  // when data loads, populate edit inputs
  useEffect(() => {
    if (!data) return;
    setNameInput(data.name ?? "");
    setLocationInput(data.location ?? "");
    setAmenitiesInput(Array.isArray(data.amenities) ? data.amenities.join(", ") : (data.amenities ? String(data.amenities) : ""));
    setRoomsInput(data.roomsAvailable ?? data.rooms ?? "");
    setPriceInput(data.price ?? "");
    // initialize geocoded coords if present in document
    const lat = data.lat ?? data.latitude ?? null;
    const lon = data.lng ?? data.longitude ?? null;
    if (lat != null && lon != null) setGeocodedCoords({ lat: Number(lat), lon: Number(lon) });
    else setGeocodedCoords(null);
  }, [data]);

  // When entering edit mode, populate inputs with the same displayed values
  useEffect(() => {
    if (!data || !isEditing) return;
    // prefer reverse-geocoded display for location when available
    const locDisplay = (reverseWords && reverseWords.length) ? reverseWords.join(", ") : (data.location ?? "");
    setNameInput(data.name ?? "");
    setLocationInput(locDisplay);
    setAmenitiesInput(Array.isArray(data.amenities) ? data.amenities.join(", ") : (data.amenities ? String(data.amenities) : ""));
    setRoomsInput(data.roomsAvailable ?? data.rooms ?? "");
    setPriceInput(data.price ?? "");
  }, [isEditing, data, reverseWords]);

  // If coordinates exist, try reverse-geocoding with OSM Nominatim
  useEffect(() => {
    let mounted = true;
    const tryReverse = async () => {
      if (!data) return;
      // try common coordinate fields
      const lat = data.lat ?? data.latitude ?? data.latLng?.lat ?? null;
      const lon = data.lng ?? data.longitude ?? data.latLng?.lng ?? data.lon ?? null;
      if (lat == null || lon == null) return;
      setReverseLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
        const resp = await fetch(url, { headers: { Accept: "application/json" } });
        if (!mounted) return;
        if (!resp.ok) throw new Error(`Reverse geocode failed: ${resp.status}`);
        const json = await resp.json();
        const display = json.display_name ?? json.address?.road ?? null;
        if (display) {
          const words = String(display).split(/[,\s]+/).filter(Boolean);
          setReverseWords(words);
          return;
        }
      } catch (err) {
        console.error("Reverse geocode failed:", err);
      } finally {
        if (mounted) setReverseLoading(false);
      }
    };

    tryReverse();
    return () => { mounted = false; };
  }, [data]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!data) return <div className="p-4">No information available.</div>;

  // Only show the requested fields
  const name = data.name ?? "Untitled";
  const locationRaw = data.location ?? "";
  // Prefer reverse-geocoded words if available, otherwise use the raw location string
  const locationDisplay = reverseWords && reverseWords.length ? reverseWords.join(", ") : (locationRaw || "-");
  // Normalize amenities into an array of strings
  const amenities = Array.isArray(data.amenities)
    ? data.amenities
    : data.amenities
    ? String(data.amenities).split(/,\s*/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Robust rooms available fallback: try multiple possible field names used across the app/data
  const roomsAvailable = (
    data.roomsAvailable ??
    data.rooms ??
    data.roomAvailable ??
    data.availability ??
    data.available ??
    data.capacity ??
    null
  );

  const roomsAvailableDisplay = (roomsAvailable == null || roomsAvailable === "") ? "-" : String(roomsAvailable);
  const price = data.price ?? data.cost ?? "-";

  const db = getFirestore(app);

  const handleSave = async () => {
    if (!data?.id) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: (nameInput || "").trim(),
        location: (locationInput || "").trim(),
        amenities: amenitiesInput ? amenitiesInput.split(",").map((s) => s.trim()) : [],
        roomsAvailable: roomsInput === "" ? 0 : Number(roomsInput),
        price: priceInput === "" ? 0 : Number(priceInput),
        updatedAt: new Date().toISOString(),
      };
      // attach geocoded coordinates when available
      if (geocodedCoords) {
        payload.lat = geocodedCoords.lat;
        payload.lng = geocodedCoords.lon;
        payload.latitude = geocodedCoords.lat;
        payload.longitude = geocodedCoords.lon;
      }
      await updateDoc(doc(db, "hotels", data.id), payload as any);
      // refresh local data
      setData((d) => ({ ...(d ?? {}), ...payload }));
      try { window.dispatchEvent(new CustomEvent("hotbook:hotel-updated", { detail: { id: data.id } })); } catch {}
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save hotel info:", err);
      alert("Failed to save hotel info. See console.");
    } finally {
      setSaving(false);
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
            if (j?.display_name) {
              setLocationInput(j.display_name);
              const words = String(j.display_name).split(/[,\s]+/).filter(Boolean);
              setReverseWords(words.length ? words : null);
            }
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

  const handleCancel = () => {
    // revert inputs to current data
    setNameInput(data.name ?? "");
    setLocationInput(data.location ?? "");
    setAmenitiesInput(Array.isArray(data.amenities) ? data.amenities.join(", ") : (data.amenities ? String(data.amenities) : ""));
    setRoomsInput(data.roomsAvailable ?? data.rooms ?? "");
    setPriceInput(data.price ?? "");
    setIsEditing(false);
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">{isEditing ? (
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full px-2 py-1 border rounded" />
        ) : name}</h3>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <div className="text-zinc-700 font-medium">Location:</div>
          <div className="text-zinc-800 w-2/3 relative">
            {isEditing ? (
              <>
                <input value={locationInput} onChange={(e) => setLocationInput(e.target.value)} className="w-full pr-20 px-2 py-1 border rounded" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button type="button" onClick={pinCurrentLocation} title="Pin my current location" aria-label="Pin my current location" className="p-1 text-zinc-600">
                    <MapPin className={pinLoading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
                  </button>

                  <MapDialogWrapper
                    initial={geocodedCoords}
                    onPick={async (c: { lat: number; lon: number }) => {
                      setGeocodedCoords(c);
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(c.lat))}&lon=${encodeURIComponent(String(c.lon))}`);
                        if (res.ok) {
                          const j = await res.json();
                          if (j?.display_name) setLocationInput(j.display_name);
                        }
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              locationDisplay
            )}
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div className="text-zinc-700 font-medium">Amenities</div>
          <div className="text-zinc-800 w-2/3">
            {isEditing ? (
              <input value={amenitiesInput} onChange={(e) => setAmenitiesInput(e.target.value)} className="w-full px-2 py-1 border rounded" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {amenities.length > 0 ? (
                  amenities.map((a: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center rounded-full bg-[#8FABD4]/15 px-2 py-0 text-[11px] text-[#4A70A9]">{a}</span>
                  ))
                ) : (
                  <span className="text-zinc-500">-</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-zinc-700 font-medium">Rooms available</div>
          <div className="text-zinc-800 w-2/3">
            {isEditing ? (
              <input type="number" value={roomsInput === "" ? "" : String(roomsInput)} onChange={(e) => setRoomsInput(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-2 py-1 border rounded" />
            ) : (
              roomsAvailableDisplay
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-zinc-700 font-medium">Price</div>
          <div className="text-zinc-800 w-2/3">
            {isEditing ? (
              <input type="number" value={priceInput === "" ? "" : String(priceInput)} onChange={(e) => setPriceInput(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-2 py-1 border rounded" />
            ) : (
              (price ?? "-")
            )}
          </div>
        </div>
      </div>

      {/* footer: show edit or save/cancel */}
      <div className="flex justify-end mt-4 gap-2">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)}>Edit</Button>
        )}
      </div>
    </div>
  );
}
