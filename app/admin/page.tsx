"use client";

import { useAuth } from "@/lib/auth-context";
// redirect not used here; admin access handled locally
import { useEffect, useState, useCallback } from "react";
import React from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import app from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddHotelForm from "@/components/add-hotel-form";
import HotelInfo from "@/components/hotel-info";
import { Info, MapPin } from "lucide-react";
// Add-hotel menu moved to the user menu in the navbar

// Simple ErrorBoundary defined at module scope so it can catch render errors in the admin UI.
class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, { error: unknown }> {
  constructor(props: { children?: React.ReactNode }) {
    super(props as any);
    this.state = { error: null };
  }
  componentDidCatch(error: unknown) {
    console.error("AdminPage caught error:", error);
    this.setState({ error });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl bg-white/90 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">Application error</h2>
            <p className="text-sm text-zinc-700">A client-side exception occurred while loading the admin dashboard. See the browser console for details.</p>
            <pre className="mt-3 text-xs text-red-600">{String(this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface HotelItem {
  id?: string;
  name: string;
  location: string;
  price?: number;
  image?: string;
  amenities?: string[];
  roomsAvailable?: number;
  // possible coordinate fields in Firestore
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  long?: number;
}

export default function AdminPage() {
  // The UI-level ErrorBoundary is defined at module scope below and used to wrap the admin UI.
  const { user, loading } = useAuth();
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [totalHotels, setTotalHotels] = useState<number | null>(null);
  const [totalBookings, setTotalBookings] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  
  // form state removed — add hotel UI moved into the navbar dialog

  // Lightweight admin sign-in (for development/demo). Honor NEXT_PUBLIC_ADMIN_CODE env var if present.
  const ADMIN_EMAIL = "admin@gmail.com";
  const ADMIN_PASSWORD = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin") : "admin";
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminSignedIn, setAdminSignedIn] = useState<boolean>(false);

  const db = getFirestore(app);

  // fetch helper moved out so we can call it from event listener
  const fetchHotels = useCallback(async () => {
    try {
      setLoadingHotels(true);
      const q = query(collection(db, "hotels"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const data: HotelItem[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as unknown as HotelItem) }));
      setHotels(data);
      setTotalHotels(data.length);
    } catch (err) {
      console.error("Failed to fetch hotels:", err);
      setHotels([]);
    } finally {
      setLoadingHotels(false);
    }
  }, [db]);

  // fetch counts for bookings and users (admin-only)
  const fetchCounts = useCallback(async () => {
    // Use a simple, safe fallback approach on the client: count documents with getDocs.
    try {
      const bookingsSnap = await getDocs(collection(db, "bookings"));
      setTotalBookings(bookingsSnap.size);
    } catch (err) {
      console.warn("Failed to fetch bookings count:", err);
      setTotalBookings(null);
    }

    try {
      const usersSnap = await getDocs(collection(db, "users"));
      setTotalUsers(usersSnap.size);
    } catch (err) {
      console.warn("Failed to fetch users count:", err);
      setTotalUsers(null);
    }
  }, [db]);

  // dialog state for per-hotel actions
  const [selectedHotel, setSelectedHotel] = useState<HotelItem | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  

  useEffect(() => {
    // read local admin flag from localStorage
    try {
      const flag = localStorage.getItem("hotbook_admin_signed_in");
      setAdminSignedIn(flag === "true");
    } catch {
      // ignore
    }

    // Only fetch hotels if we're admin (either Firebase user or local flag)
    if ((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) {
      fetchHotels();
      fetchCounts();
    }

    const onAdded = () => {
      if ((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) {
        fetchHotels();
        fetchCounts();
      }
    };

    window.addEventListener("hotbook:hotel-added", onAdded);
    return () => {
      window.removeEventListener("hotbook:hotel-added", onAdded);
    };
  }, [user, loading, fetchHotels, fetchCounts, adminSignedIn]);

  

  // Handler for lightweight admin sign-in
  const handleAdminSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const email = adminEmailInput.trim().toLowerCase();
    const password = adminPasswordInput.trim();
    if (email !== ADMIN_EMAIL) {
      alert("Invalid admin email");
      return;
    }
    if (password !== ADMIN_PASSWORD) {
      alert("Invalid admin password");
      return;
    }
    try {
      localStorage.setItem("hotbook_admin_signed_in", "true");
    } catch {
      // ignore
    }
    setAdminSignedIn(true);
    // fetch will be triggered by effect
  };

  // Handlers for card actions (open dialogs)
  const handleInfo = (h: HotelItem) => {
    setSelectedHotel(h);
    setInfoOpen(true);
  };

  const handleViewMap = (h: HotelItem) => {
    // Prefer explicit coordinates stored in Firestore
    const lat = (h.lat ?? h.latitude) as number | undefined;
    const lon = (h.lng ?? h.long ?? h.longitude) as number | undefined;

    if (typeof lat === "number" && typeof lon === "number") {
      // Open an embedded OpenStreetMap in a dialog
      setSelectedHotel(h);
      setMapOpen(true);
      return;
    }

    // Fallback: use location string search
    if (!h.location) return alert("No location available");
    const q = encodeURIComponent(h.location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  // (sign-out removed — admin demo flow uses localStorage flag)

  // Render
  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-semibold mb-4">Admin Dashboard</h1>

        {/* If not authenticated as admin, show lightweight sign-in form */}
        {(!user || user.email?.toLowerCase() !== ADMIN_EMAIL) && !adminSignedIn ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Admin sign-in</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminSignIn} className="grid grid-cols-1 gap-3">
                <input
                  required
                  placeholder="Admin email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  required
                  placeholder="Admin password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  type="password"
                  className="w-full px-3 py-2 border rounded"
                />

                <div className="flex justify-end gap-2">
                  <Button type="submit">Sign in as admin</Button>
                </div>
              </form>
              <p className="text-xs text-zinc-500 mt-2">Tip: Default admin password is <code>admin</code> unless you set <code>NEXT_PUBLIC_ADMIN_PASSWORD</code>.</p>
            </CardContent>
          </Card>
        ) : ( <>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium">Hotels</h2>
          {((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Add Hotel</Button>
              </DialogTrigger>
              <DialogContent className="w-96 p-4">
                <DialogHeader>
                  <DialogTitle>Add New Hotel</DialogTitle>
                </DialogHeader>
                <AddHotelForm />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Top stats: total hotels, bookings, users */}
        {((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-white/90 dark:bg-zinc-900/80 p-3 text-center shadow-sm">
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{totalHotels ?? "—"}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Total hotels</div>
            </div>
            <div className="rounded-lg bg-white/90 dark:bg-zinc-900/80 p-3 text-center shadow-sm">
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{totalBookings ?? "—"}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Total bookings</div>
            </div>
            <div className="rounded-lg bg-white/90 dark:bg-zinc-900/80 p-3 text-center shadow-sm">
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{totalUsers ?? "—"}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Total users</div>
            </div>
          </div>
        )}

        {loadingHotels ? (
          <p>Loading hotels...</p>
        ) : hotels.length === 0 ? (
          <p>No hotels found. Add one using the menu above.</p>
        ) : (
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
            {hotels.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{h.name}</p>
                    <p className="text-sm text-zinc-600">{h.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleInfo(h)} title="Info" aria-label={`Info for ${h.name}`}>
                      <Info className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleViewMap(h)} title="View map" aria-label={`View map for ${h.name}`}>
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Edit dialog removed — editing is handled inline in `HotelInfo` */}

        {/* Info dialog */}
        {selectedHotel && (
          <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
            <DialogContent className="w-96 p-4">
              <DialogHeader>
                <DialogTitle>Hotel Info</DialogTitle>
              </DialogHeader>
              <HotelInfo hotel={selectedHotel} />
            </DialogContent>
          </Dialog>
        )}
        {/* Map dialog (OpenStreetMap embed) */}
        {selectedHotel && mapOpen && selectedHotel && (
          <Dialog open={mapOpen} onOpenChange={setMapOpen}>
            <DialogContent className="w-[90vw] max-w-3xl p-0 h-[70vh]">
              <div className="h-full">
                {(() => {
                  const lat = (selectedHotel.lat ?? selectedHotel.latitude) as number | undefined;
                  const lon = (selectedHotel.lng ?? selectedHotel.long ?? selectedHotel.longitude) as number | undefined;
                  if (typeof lat === "number" && typeof lon === "number") {
                    const latNum = Number(lat);
                    const lonNum = Number(lon);
                    const delta = 0.01; // bbox half-size
                    const bboxLeft = lonNum - delta;
                    const bboxBottom = latNum - delta;
                    const bboxRight = lonNum + delta;
                    const bboxTop = latNum + delta;
                    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bboxLeft},${bboxBottom},${bboxRight},${bboxTop}&layer=mapnik&marker=${latNum},${lonNum}`;
                    return (
                      <div className="h-full">
                        <iframe src={src} className="w-full h-[calc(100%-28px)]" />
                        <div className="p-2 text-xs">
                          <a href={`https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lonNum}#map=18/${latNum}/${lonNum}`} target="_blank" rel="noreferrer">Open larger map in OpenStreetMap</a>
                        </div>
                      </div>
                    );
                  }
                  return <div className="p-4">No coordinates available for this hotel.</div>;
                })()}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
