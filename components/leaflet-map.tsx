"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Ensure Leaflet is initialized before react-leaflet components mount.
if (typeof window !== "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require("leaflet") as typeof import("leaflet");
    if ((L as any)?.Icon?.Default?.prototype) {
      try {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
      } catch {}
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    }
  } catch (e) {
    // ignore — best-effort initialization
  }
}

export default function LeafletMap({
  lat,
  lon,
  name,
  address,
}: {
  lat: number;
  lon: number;
  name: string;
  address?: string;
}) {
  const [map, setMap] = useState<any | null>(null);
  const mapRef = useRef<any | null>(null);
  const containerId = useRef(`leaflet-map-${Math.random().toString(36).slice(2, 9)}`);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    // Before rendering the MapContainer, remove any leftover container from prior mounts
    // This avoids "Map container is being reused by another instance" errors during HMR or fast navigation.
    try {
      if (typeof document !== "undefined") {
        const existing = document.getElementById(containerId.current);
        if (existing) {
          // If a Leaflet instance is attached, attempt to remove it gracefully
          try {
            // @ts-ignore
            if (existing._leaflet_id) {
              // try to delete the internal id so Leaflet won't detect reuse
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              delete existing._leaflet_id;
            }
          } catch (e) {
            // ignore
          }
          // Remove the old container element entirely to be safe
          existing.remove();
        }
      }
    } catch (e) {
      // ignore any DOM errors
    }

    // Allow the MapContainer to render after cleanup
    setShowMap(true);

    return () => {
      // cleanup on unmount
      try {
        if (mapRef.current && typeof mapRef.current.remove === "function") {
          mapRef.current.remove();
          mapRef.current = null;
        }
        if (typeof document !== "undefined") {
          const existing = document.getElementById(containerId.current);
          if (existing) existing.remove();
        }
      } catch (e) {}
    };
  }, []);

  if (!showMap) return null;

  return (
    <MapContainer
      id={containerId.current}
      key={`${containerId.current}-${lat}-${lon}`}
      center={[lat, lon]}
      zoom={16}
      scrollWheelZoom
      style={{ width: "100%", height: "100%", zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={[lat, lon]}>
        <Popup>
          <div>
            <h3 className="font-bold">{name}</h3>
            <p className="text-sm">{address}</p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
