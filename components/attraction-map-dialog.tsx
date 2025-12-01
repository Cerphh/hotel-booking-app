"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import dynamic from "next/dynamic";
import { haversineDistanceMeters, formatDistance, formatWalkingTime } from "@/lib/utils";

// Dynamically load react-leaflet components to avoid SSR
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotel: { lat: number; lon: number; name?: string };
  attraction: { lat: number; lon: number; name?: string; distance?: string } | null;
}

export default function AttractionMapDialog({ open, onOpenChange, hotel, attraction }: Props) {
  if (typeof window === "undefined") return null;
  if (!hotel) return null;

  const center: [number, number] =
    attraction && typeof attraction.lat === "number" && typeof attraction.lon === "number"
      ? [(hotel.lat + attraction.lat) / 2, (hotel.lon + attraction.lon) / 2]
      : [hotel.lat, hotel.lon];
  const polylinePositions: [number, number][] =
    attraction && typeof attraction.lat === "number" && typeof attraction.lon === "number"
      ? [[hotel.lat, hotel.lon], [attraction.lat, attraction.lon]]
      : [];

  // compute distance if coordinates available
  const distanceMeters = attraction && typeof attraction.lat === "number" && typeof attraction.lon === "number"
    ? haversineDistanceMeters(hotel.lat, hotel.lon, attraction.lat, attraction.lon)
    : NaN;
  const distanceLabel = Number.isFinite(distanceMeters) ? formatDistance(distanceMeters) : attraction?.distance || "";
  const walkingLabel = Number.isFinite(distanceMeters) ? formatWalkingTime(distanceMeters) : attraction?.walkingTime || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              Map — {attraction?.name || "Location"}
              {distanceLabel ? ` • ${distanceLabel}` : ""}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Positioned directions button to the left of the dialog close (X) button */}
        {attraction && typeof attraction.lat === 'number' && typeof attraction.lon === 'number' && (
          <a
            className="absolute top-2 right-12 z-50 inline-flex items-center rounded-md bg-[#4A70A9] px-3 py-1 text-xs font-semibold text-white hover:bg-[#4A70A9]/90 shadow-lg"
            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${hotel.lat},${hotel.lon}`)}&destination=${encodeURIComponent(`${attraction.lat},${attraction.lon}`)}&travelmode=walking`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions
          </a>
        )}

        <div style={{ height: 480, width: "100%" }} className="rounded-b-lg">
          <MapContainer center={center} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            <Marker position={[hotel.lat, hotel.lon] as any}>
              <Popup>
                <div>
                  <strong>{hotel.name || "Hotel"}</strong>
                  <div className="text-xs">Your hotel</div>
                </div>
              </Popup>
            </Marker>

            {attraction && (
              <>
                <Marker position={[attraction.lat, attraction.lon] as any}>
                  <Popup>
                    <div>
                      <strong>{attraction.name || "Attraction"}</strong>
                      {distanceLabel && <div className="text-xs">{distanceLabel}</div>}
                      {walkingLabel && <div className="text-xs">{walkingLabel}</div>}
                    </div>
                  </Popup>
                </Marker>

                <Polyline positions={polylinePositions as any} pathOptions={{ color: "#4A70A9" }} />
              </>
            )}
          </MapContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
