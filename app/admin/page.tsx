"use client";

import { useAuth } from "@/lib/auth-context";
// redirect not used here; admin access handled locally
import { useEffect, useState, useCallback } from "react";
import React from "react";
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc } from "firebase/firestore";
import app from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface BookingItem {
  id?: string;
  hotelId?: string;
  hotelName?: string;
  hotelImage?: string;
  userEmail?: string;
  userId?: string;
  userName?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  roomType?: string;
  bookingType?: string;
  totalPrice?: number;
  status?: string;
  bookingDate?: string;
  createdAt?: any;
}

export default function AdminPage() {
  // The UI-level ErrorBoundary is defined at module scope below and used to wrap the admin UI.
  const { user, loading } = useAuth();
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [totalHotels, setTotalHotels] = useState<number | null>(null);
  const [totalBookings, setTotalBookings] = useState<number | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [showBookings, setShowBookings] = useState(false);
  
  // form state removed — add hotel UI moved into the navbar dialog

  // Lightweight admin sign-in (for development/demo). Honor NEXT_PUBLIC_ADMIN_CODE env var if present.
  const ADMIN_EMAIL = "admin@gmail.com";
  const ADMIN_PASSWORD = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin") : "admin";
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminSignedIn, setAdminSignedIn] = useState<boolean>(() => {
    try {
      return (typeof window !== 'undefined' && localStorage.getItem("hotbook_admin_signed_in") === "true") || false;
    } catch {
      return false;
    }
  });

  const db = getFirestore(app);

  const [showHotels, setShowHotels] = useState(false);

  // Small presentational donut that displays a centered count.
  const Donut = ({
    count,
    label = "",
    onActivate,
  }: {
    count: number | null;
    label?: string;
    onActivate?: () => void;
  }) => {
    const size = 220;
    const stroke = 24;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    // Decorative full ring for now; progress can be used later.
    const progress = 100;
    const dashoffset = circumference - (progress / 100) * circumference;

    // Draw the colored gradient ring slightly inside the base ring so the
    // base (background) ring remains visible as a dark-gray "pie" color
    // in both light and dark themes.
    const innerRadius = Math.max(8, radius - Math.round(stroke * 0.15));
    const innerCircumference = 2 * Math.PI * innerRadius;
    const innerDashoffset = innerCircumference - (progress / 100) * innerCircumference;

    const interactive = typeof onActivate === "function";

    // Detect dark mode on the client and pick muted, non-vibrant colors that
    // complement the background in each theme.
    const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
    const baseColorClass = isDark ? 'text-zinc-400/70' : 'text-zinc-600/80';
    // Muted neutral colors (non-vibrant) for dark/light themes
    const solidColor = isDark ? '#9CA3AF' : '#6B7280';

    return (
      <div
        className={`relative w-[220px] h-[220px] mx-auto ${baseColorClass} ${interactive ? 'cursor-pointer' : ''}`}
        {...(interactive
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: onActivate,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onActivate();
                }
              },
            }
          : {})}
      >
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{label}</div>

        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" aria-hidden>
          {/* single-color donut: no gradient defs needed */}
          <g transform={`translate(${size / 2}, ${size / 2})`}>
            <circle r={radius} fill="none" strokeWidth={stroke} stroke={solidColor} />
            <circle
              r={innerRadius}
              fill="none"
              strokeWidth={Math.max(6, stroke - 8)}
              stroke={solidColor}
              strokeLinecap="round"
              strokeDasharray={`${innerCircumference} ${innerCircumference}`}
              strokeDashoffset={innerDashoffset}
              transform={`rotate(-90)`}
            />
          </g>
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-5xl font-semibold text-zinc-900 dark:text-zinc-100">{count ?? '—'}</div>
        </div>
      </div>
    );
  };

  // bookings UI and server-side counts removed from admin dashboard

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

  const fetchPendingHotels = useCallback(async () => {
    try {
      setLoadingPending(true);
      // Fetch pending items from in-memory API
      const res = await fetch("/api/pending");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HotelItem[] = await res.json();

      // Also filter out any pending items that have already been approved
      try {
        const snap = await getDocs(query(collection(db, "hotels"), orderBy("name", "asc")) as any);
        const ids = snap.docs.map((d) => d.id);
        // Build a set of name+location keys for extra matching fallback
        const keySet = new Set<string>();
        snap.docs.forEach((d) => {
          const dt = d.data() as any;
          const name = (dt.name || "").toString().trim().toLowerCase();
          const location = (dt.location || "").toString().trim().toLowerCase();
          if (name || location) keySet.add(`${name}:::${location}`);
        });

        const filtered = Array.isArray(data)
          ? data.filter((p: any) => {
              if (ids.includes(String(p.id))) return false;
              const name = (p.name || "").toString().trim().toLowerCase();
              const location = (p.location || "").toString().trim().toLowerCase();
              if (keySet.has(`${name}:::${location}`)) return false;
              return true;
            })
          : [];
        setPendingHotels(filtered);
      } catch (err) {
        // If fetching hotels fails, fall back to showing raw pending items
        console.warn("Failed to fetch hotels while filtering pending items:", err);
        setPendingHotels(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending hotels:", err);
      setPendingHotels([]);
    } finally {
      setLoadingPending(false);
    }
  }, [db]);

  const fetchBookings = useCallback(async () => {
    try {
      setLoadingBookings(true);
      // Order by createdAt if available, otherwise fallback to bookingDate
      let q;
      try {
        q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      } catch (e) {
        q = query(collection(db, "bookings"));
      }
      const snap = await getDocs(q as any);
      const data: BookingItem[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBookings(data);
      setTotalBookings(data.length);
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
      setBookings([]);
      setTotalBookings(null);
    } finally {
      setLoadingBookings(false);
    }
  }, [db]);

  // (bookings/users counts removed — only total hotels shown)
  // If you later want bookings/users counts, reintroduce aggregate queries here.
  const fetchCounts = useCallback(async () => {
    try {
      // Fetch a simple total of bookings from Firestore
      const q = query(collection(db, "bookings"));
      const snap = await getDocs(q);
      setTotalBookings(snap.size);
    } catch (err) {
      console.error("Failed to fetch counts:", err);
      setTotalBookings(null);
    }
  }, [db]);

  // dialog state for per-hotel actions
  const [selectedHotel, setSelectedHotel] = useState<HotelItem | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingHotels, setPendingHotels] = useState<HotelItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  // decision dialog state for approve/reject confirmation
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<"approve" | "reject" | null>(null);
  const [decisionHotel, setDecisionHotel] = useState<HotelItem | null>(null);

  

  useEffect(() => {
    // Only fetch hotels if we're admin (either Firebase user or local flag)
    if ((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) {
      fetchHotels();
      fetchCounts();
      fetchPendingHotels();
      fetchBookings();
    }

    const onAdded = () => {
      if ((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) {
        fetchHotels();
        fetchCounts();
        fetchPendingHotels();
      }
    };

    const onPendingAdded = () => {
      if ((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) {
        fetchPendingHotels();
      }
    };

    const onBookingAdded = () => {
      if ((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) {
        fetchBookings();
        fetchCounts();
      }
    };

    window.addEventListener("hotbook:hotel-added", onAdded);
    window.addEventListener("hotbook:pending-hotel-added", onPendingAdded);
    window.addEventListener("hotbook:booking-added", onBookingAdded);
    return () => {
      window.removeEventListener("hotbook:hotel-added", onAdded);
      window.removeEventListener("hotbook:pending-hotel-added", onPendingAdded);
      window.removeEventListener("hotbook:booking-added", onBookingAdded);
    };
  }, [user, loading, fetchHotels, fetchCounts, fetchPendingHotels, adminSignedIn]);

  // fetch pending when dialog opens
  useEffect(() => {
    if (pendingDialogOpen) fetchPendingHotels();
  }, [pendingDialogOpen, fetchPendingHotels]);

  // bookings list UI removed


  // Approve a pending hotel: copy to `hotels` then delete pending doc
  const approvePending = async (h: HotelItem) => {
    if (!h.id) return;
    try {
      // Use the pending item provided by the API/list and write to Firestore
      const approvedBy = user?.email ?? "admin";
      const approvedAt = new Date().toISOString();
      const targetRef = doc(db, "hotels", String(h.id));
      // copy the pending fields into hotels; avoid sending the id twice
      await setDoc(targetRef, { ...(h as unknown as Record<string, unknown>), verified: true, approvedBy, approvedAt }, { merge: true });

      // Do NOT remove the server-side pending entry here. Instead, mark the
      // item as accepted locally and notify other clients. Keeping the
      // pending entry server-side ensures the original submission remains
      // discoverable; the dashboard UI will keep the request visible and
      // render it as "Approved" based on the status flags.
      try {
        try {
          window.dispatchEvent(new CustomEvent("hotbook:pending-hotel-updated", { detail: { id: String(h.id), status: 'accepted' } }));
          window.dispatchEvent(new CustomEvent("hotbook:hotel-added", { detail: { id: String(h.id) } }));
        } catch {
          // ignore
        }
        // Update this admin UI's pending list to reflect accepted status (keep item visible)
        setPendingHotels((prev) => {
          return (prev || []).map((x) => (String(x.id) === String(h.id) ? { ...x, status: 'accepted', accepted: true } : x));
        });
      } catch (e) {
        console.warn("Failed to mark pending item as accepted locally:", e);
      }

      // refresh lists
      fetchHotels();
      fetchPendingHotels();
      fetchCounts();
      alert("Hotel approved and published.");
    } catch (err) {
      console.error("Failed to approve pending hotel:", err);
      alert("Failed to approve pending hotel. See console for details.");
    }
  };

  const rejectPending = async (h: HotelItem) => {
    if (!h.id) return;
    try {
      // Delete the pending item from the server-side pending store so it
      // no longer appears in the admin requests list. The dashboard will
      // merge its local copy and set the status to 'rejected' so users
      // still see the submission marked rejected.
      try {
        const res = await fetch(`/api/pending/${encodeURIComponent(String(h.id))}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) {
          console.warn("Pending DELETE returned non-ok status", res.status);
        }
      } catch {
        // ignore network errors
      }

      try {
        await fetch(`/api/pending/ensure-delete`, {
          method: "POST",
          body: JSON.stringify({ id: h.id, name: h.name, location: h.location }),
          headers: { "content-type": "application/json" },
        });
      } catch {
        // ignore
      }

      // Notify other clients that the pending item was updated/removed.
      try {
        window.dispatchEvent(new CustomEvent("hotbook:pending-hotel-updated", { detail: { id: String(h.id), status: 'rejected' } }));
        window.dispatchEvent(new CustomEvent("hotbook:pending-hotel-removed", { detail: { id: String(h.id) } }));
      } catch {
        // ignore
      }

      // Remove from this admin UI's pending list
      setPendingHotels((prev) => (prev || []).filter((x) => String(x.id) !== String(h.id)));
      fetchPendingHotels();
      alert("Pending hotel rejected and removed from admin requests.");
    } catch (err) {
      console.error("Failed to reject pending hotel:", err);
      alert("Failed to reject pending hotel. See console for details.");
    }
  };

  // Confirm decision handler (called from confirmation dialog)
  const handleConfirmDecision = async () => {
    if (!decisionHotel || !decisionAction) return;
    const h = decisionHotel;
    setDecisionDialogOpen(false);
    setDecisionAction(null);
    setDecisionHotel(null);

    if (decisionAction === "approve") {
      await approvePending(h);
    } else if (decisionAction === "reject") {
      await rejectPending(h);
    }
  };

  // Accept a booking (mark as accepted in Firestore)
  const acceptBooking = async (b: BookingItem) => {
    if (!b.id) return;
    if (!confirm(`Approve booking for ${b.hotelName || b.userEmail}?`)) return;
    try {
      const acceptedBy = user?.email ?? 'admin';
      const acceptedAt = new Date().toISOString();
      const targetRef = doc(db, "bookings", String(b.id));
      await setDoc(targetRef, { status: 'accepted', acceptedBy, acceptedAt }, { merge: true });
      // update local list
      setBookings((prev) => (prev || []).map((x) => (String(x.id) === String(b.id) ? { ...x, status: 'accepted', acceptedBy, acceptedAt } : x)));
      try { window.dispatchEvent(new CustomEvent('hotbook:booking-updated', { detail: { id: String(b.id), status: 'accepted' } })); } catch {}
      fetchCounts();
      alert('Booking approved.');
    } catch (err) {
      console.error('Failed to accept booking:', err);
      alert('Failed to accept booking. See console for details.');
    }
  };

  // Reject a booking (mark as rejected in Firestore)
  const rejectBooking = async (b: BookingItem) => {
    if (!b.id) return;
    if (!confirm(`Reject booking for ${b.hotelName || b.userEmail}?`)) return;
    try {
      const rejectedBy = user?.email ?? 'admin';
      const rejectedAt = new Date().toISOString();
      const targetRef = doc(db, "bookings", String(b.id));
      await setDoc(targetRef, { status: 'rejected', rejectedBy, rejectedAt }, { merge: true });
      // update local list
      setBookings((prev) => (prev || []).map((x) => (String(x.id) === String(b.id) ? { ...x, status: 'rejected', rejectedBy, rejectedAt } : x)));
      try { window.dispatchEvent(new CustomEvent('hotbook:booking-updated', { detail: { id: String(b.id), status: 'rejected' } })); } catch {}
      fetchCounts();
      alert('Booking rejected.');
    } catch (err) {
      console.error('Failed to reject booking:', err);
      alert('Failed to reject booking. See console for details.');
    }
  };

  

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
            <div className="ml-4">
              <Button onClick={() => setPendingDialogOpen(true)} variant="outline" className="relative px-4 py-2">
                <span>Hotel Requests</span>
                {pendingHotels.length > 0 && (
                  <Badge className="absolute -top-2 right-2 bg-red-600 text-white rounded-full px-2 py-0.5 text-xs">{pendingHotels.length}</Badge>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Top stats: total hotels, bookings, users */}
        {((user && user.email?.toLowerCase() === ADMIN_EMAIL) || adminSignedIn) && (
          <div className="flex items-center justify-center mb-6 h-[60vh]">
            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full">
              <div className="p-0 text-center mx-auto">
                <Donut count={totalHotels} label="Total hotels" onActivate={() => setShowHotels(true)} />
              </div>

              <div className="p-0 text-center mx-auto">
                <Donut count={totalBookings} label="Total bookings" onActivate={() => setShowBookings(true)} />
              </div>
            </div>
          </div>
        )}

        {/* Hotel requests dialog (opened from header) */}
        <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
          <DialogContent className="w-[90vw] max-w-2xl p-4">
            <DialogHeader>
              <DialogTitle>Hotel Requests</DialogTitle>
            </DialogHeader>
            {loadingPending ? (
              <p>Loading hotel requests...</p>
            ) : pendingHotels.length === 0 ? (
              <p className="text-sm text-zinc-600">No hotel requests.</p>
            ) : (
              <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                {pendingHotels.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt={p.name || "pending hotel"} className="w-20 h-14 object-cover rounded-md" />
                        ) : (
                          <div className="w-20 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center text-xs text-zinc-500">No image</div>
                        )}

                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-sm text-zinc-600">{p.location}</p>

                          <div className="mt-2 text-xs text-zinc-600">
                            <div><strong>Price:</strong> {typeof p.price === 'number' ? `₱${p.price.toLocaleString()}` : (p.price ? `₱${p.price}` : 'N/A')}</div>
                            <div><strong>Rooms:</strong> {p.roomsAvailable ?? 'N/A'}</div>
                            <div className="truncate"><strong>Amenities:</strong> {Array.isArray(p.amenities) ? p.amenities.join(', ') : (p.amenities || 'None')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setDecisionAction("approve");
                            setDecisionHotel(p);
                            setDecisionDialogOpen(true);
                          }}
                        >
                          Approve
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDecisionAction("reject");
                            setDecisionHotel(p);
                            setDecisionDialogOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

          {/* Hotels dialog (opens when clicking the donut) */}
          <Dialog open={showHotels} onOpenChange={setShowHotels}>
            <DialogContent className="w-[90vw] max-w-3xl p-4">
              <DialogHeader>
                <DialogTitle>Hotels</DialogTitle>
              </DialogHeader>
              {loadingHotels ? (
                <p>Loading hotels...</p>
              ) : hotels.length === 0 ? (
                <p className="text-sm text-zinc-600">No hotels found.</p>
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
            </DialogContent>
          </Dialog>

          {/* Bookings dialog (opens when clicking the bookings donut) */}
          <Dialog open={showBookings} onOpenChange={setShowBookings}>
            <DialogContent className="w-[90vw] max-w-3xl p-4">
              <DialogHeader>
                <DialogTitle>Bookings</DialogTitle>
              </DialogHeader>
              {loadingBookings ? (
                <p>Loading bookings...</p>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-zinc-600">No bookings found.</p>
              ) : (
                <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                  {bookings.map((b) => (
                    <Card key={b.id}>
                      <CardContent className="flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {b.hotelImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.hotelImage} alt={b.hotelName || "booking"} className="w-20 h-14 object-cover rounded-md" />
                          ) : (
                            <div className="w-20 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center text-xs text-zinc-500">No image</div>
                          )}

                          <div>
                            <p className="font-semibold">{b.hotelName}</p>
                            <p className="text-sm text-zinc-600">{b.userName ?? b.userEmail}</p>

                            <div className="mt-2 text-xs text-zinc-600">
                              <div><strong>Dates:</strong> {b.checkIn ?? 'N/A'} → {b.checkOut ?? 'N/A'}</div>
                              <div><strong>Rooms:</strong> {b.rooms ?? 'N/A'}</div>
                              <div className="truncate"><strong>Total:</strong> {typeof b.totalPrice === 'number' ? `₱${b.totalPrice.toLocaleString()}` : (b.totalPrice ? `₱${b.totalPrice}` : 'N/A')}</div>
                              <div><strong>Status:</strong> {(b.status ?? 'pending')}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end text-right text-xs text-zinc-600 gap-2">
                          <div>{b.bookingDate ? new Date(String(b.bookingDate)).toLocaleString() : (b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString() : '')}</div>
                          <div className="mt-1 text-xs text-zinc-500">{b.id}</div>

                          {/* Buttons removed: admin bookings are view-only here. Use accept/reject actions elsewhere if needed. */}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Bookings dialog removed */}

        {/* Decision confirmation dialog for approve/reject */}
        <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{decisionAction === 'approve' ? 'Approve pending submission' : 'Reject pending submission'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">Are you sure you want to {decisionAction} <strong>{decisionHotel?.name}</strong>?</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setDecisionDialogOpen(false); setDecisionAction(null); setDecisionHotel(null); }}>Cancel</Button>
                <Button variant={decisionAction === 'reject' ? 'destructive' : 'default'} onClick={handleConfirmDecision}>
                  {decisionAction === 'reject' ? 'Confirm Reject' : 'Confirm Approve'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pending submissions awaiting admin review */}
        {/* pending submissions are available from the header button */}

        {loadingHotels ? (
          <p>Loading hotels...</p>
        ) : null}
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
