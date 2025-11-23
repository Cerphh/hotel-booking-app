"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import app from "@/lib/firebase";

interface HotelItem {
  id?: string;
  [key: string]: any;
}

export default function EditHotelForm({ hotel, onSaved }: { hotel: HotelItem; onSaved?: () => void }) {
  const db = getFirestore(app);
  const [loading, setLoading] = useState(false);
  const [docData, setDocData] = useState<Record<string, any>>({});
  const [fieldTypes, setFieldTypes] = useState<Record<string, string>>({});

  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Load latest hotel doc and capture all fields and their types
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!hotel) return;
      try {
        let d: Record<string, any> | undefined = undefined;
        if (hotel.id) {
          const snap = await getDoc(doc(db, "hotels", hotel.id));
          if (!mounted) return;
          if (snap.exists()) {
            d = snap.data() as Record<string, any>;
          }
        }
        if (!d) d = { ...(hotel as Record<string, any>) };

        // remove any Firestore internal fields if present
        const cleaned: Record<string, any> = {};
        const types: Record<string, string> = {};
        Object.keys(d).forEach((k) => {
          const v = (d as any)[k];
          // skip undefined
          if (typeof v === "undefined") return;
          cleaned[k] = v;
          if (Array.isArray(v)) types[k] = "array";
          else if (v === null) types[k] = "null";
          else types[k] = typeof v;
        });

        if (mounted) {
          setDocData(cleaned);
          setFieldTypes(types);
        }
      } catch (err) {
        console.error("Failed to load hotel for editing:", err);
      }
    };

    load();
    return () => { mounted = false; };
  }, [hotel?.id]);

  const handleChange = (key: string, value: any) => {
    setDocData((s) => ({ ...s, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel?.id) return alert("Missing hotel id");
    setLoading(true);
    try {
      const payload: Record<string, any> = {};
      Object.keys(docData).forEach((k) => {
        if (k === "id") return; // never write id field
        const t = fieldTypes[k] ?? typeof docData[k];
        const raw = docData[k];

        if (t === "array") {
          // if user edited as string, split by comma
          if (typeof raw === "string") payload[k] = raw ? raw.split(",").map((s: string) => s.trim()) : [];
          else payload[k] = Array.isArray(raw) ? raw : [];
        } else if (t === "number") {
          payload[k] = raw === "" || raw == null ? 0 : Number(raw);
        } else if (t === "boolean") {
          payload[k] = Boolean(raw);
        } else if (t === "object") {
          // accept JSON string or object
          if (typeof raw === "string") {
            try { payload[k] = JSON.parse(raw); } catch { payload[k] = raw; }
          } else payload[k] = raw;
        } else {
          // strings, nulls, etc.
          payload[k] = typeof raw === "string" ? raw.trim() : raw;
        }
      });

      payload.updatedAt = new Date().toISOString();

      await updateDoc(doc(db, "hotels", hotel.id), payload as any);

      try { window.dispatchEvent(new CustomEvent("hotbook:hotel-updated", { detail: { id: hotel.id } })); } catch {}

      alert("Hotel updated");
      if (closeRef.current) closeRef.current.click();
      onSaved?.();
    } catch (err) {
      console.error("Failed to update hotel:", err);
      alert("Failed to update hotel. See console.");
    } finally {
      setLoading(false);
    }
  };

  // Render inputs for each field discovered
  const keys = Object.keys(docData || {});
  // prefer ordering for common fields
  const preferredOrder = ["name", "location", "amenities", "roomsAvailable", "price"];
  keys.sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia !== -1 || ib !== -1) return ia - ib;
    return a.localeCompare(b);
  });

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2">
      {keys.map((k) => {
        if (k === "id") return null;
        const t = fieldTypes[k] ?? typeof docData[k];
        const value = docData[k];

        if (t === "array") {
          return (
            <div key={k}>
              <label className="text-sm font-medium">{k}</label>
              <input placeholder="Comma separated" value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(e) => handleChange(k, e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
          );
        }

        if (t === "number") {
          return (
            <div key={k}>
              <label className="text-sm font-medium">{k}</label>
              <input type="number" value={value === null || typeof value === "undefined" ? "" : String(value)} onChange={(e) => handleChange(k, e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 border rounded" />
            </div>
          );
        }

        if (t === "boolean") {
          return (
            <div key={k} className="flex items-center gap-2">
              <input id={`chk-${k}`} type="checkbox" checked={Boolean(value)} onChange={(e) => handleChange(k, e.target.checked)} />
              <label htmlFor={`chk-${k}`} className="text-sm">{k}</label>
            </div>
          );
        }

        if (t === "object") {
          return (
            <div key={k}>
              <label className="text-sm font-medium">{k} (JSON)</label>
              <textarea value={typeof value === "string" ? value : JSON.stringify(value, null, 2)} onChange={(e) => handleChange(k, e.target.value)} className="w-full px-3 py-2 border rounded" rows={4} />
            </div>
          );
        }

        // default string
        return (
          <div key={k}>
            <label className="text-sm font-medium">{k}</label>
            <input value={value ?? ""} onChange={(e) => handleChange(k, e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-2">
        <DialogClose asChild>
          <button ref={closeRef} className="hidden" />
        </DialogClose>
        <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}

