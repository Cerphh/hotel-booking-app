"use client";

import React, { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MapPinPicker from "./map-pin-picker";

interface Props {
  initial?: { lat: number; lon: number } | null;
  onPick: (coords: { lat: number; lon: number }) => void;
}

export default function MapDialogWrapper({ initial = null, onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" title="Pin on map" aria-label="Pin on map" className="p-1 text-zinc-600">📍</button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pin location on map</DialogTitle>
        </DialogHeader>

        <div>
          <MapPinPicker
            initial={initial}
            onSelect={(c) => {
              try {
                onPick(c);
              } catch (e) {
                // ignore
              }
              setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
