"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  L = require("leaflet");
  if (L?.Icon?.Default?.prototype) {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }
}

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });

interface Props {
  initial?: { lat: number; lon: number } | null;
  onSelect: (coords: { lat: number; lon: number }) => void;
}

export default function MapPinPicker({ initial = null, onSelect }: Props) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(initial);

  // wrapper to use map events inside dynamic import
  const MapEventHandler = (props: { onClick: (lat: number, lon: number) => void }) => {
    // Dynamically require the hook at runtime so we don't import react-leaflet hooks
    // statically while other react-leaflet components are dynamically loaded.
    // This avoids potential hook ordering / SSR hydration issues.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useMapEvents } = require("react-leaflet");
    // @ts-ignore - react-leaflet dynamic import typing
    const map = (useMapEvents as any)({
      click(e: any) {
        props.onClick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  useEffect(() => {
    setCoords(initial ?? null);
  }, [initial?.lat, initial?.lon]);

  const handleMapClick = (lat: number, lon: number) => setCoords({ lat, lon });

  const handleDragEnd = (e: any) => {
    const marker = e?.target;
    if (!marker) return;
    const pos = marker.getLatLng();
    setCoords({ lat: pos.lat, lon: pos.lng });
  };

  const center: [number, number] = coords ? [coords.lat, coords.lon] : [13.7569, 121.0583];

  return (
    <div className="w-full h-[60vh] md:h-[50vh]">
      {/* @ts-ignore */}
      <MapContainer center={center} zoom={13} style={{ width: "100%", height: "100%" }}>
        {/* @ts-ignore */}
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
        {/* @ts-ignore */}
        <MapEventHandler onClick={handleMapClick} />
        {coords && (
          // @ts-ignore
          <Marker
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
            position={[coords.lat, coords.lon]}
          />
        )}
      </MapContainer>

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (!coords) return alert("Click on the map to place a marker first");
            onSelect(coords);
          }}
          className="rounded bg-[#4A70A9] px-4 py-2 text-white"
        >
          Use this location
        </button>
      </div>
    </div>
  );
}
