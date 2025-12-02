"use client"; // must be first

import { useAuth } from "@/lib/auth-context";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, User2, Trash2, Info } from "lucide-react";

// Generic record type for Firestore document data (avoid `any`)
type DocData = Record<string, unknown>;

// Pending submission shape (minimal, extend as needed)
interface PendingSubmission {
  id: string;
  name?: string;
  location?: string;
  price?: number | string;
  roomsAvailable?: number;
  createdAt?: string | number | Date;
  image?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  status?: "pending" | "accepted" | "rejected";
  accepted?: boolean;
  rejected?: boolean;
  submitterEmail?: string;
}
import dynamic from "next/dynamic";
import { useMap } from "react-leaflet";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  FirestoreError,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import app from "@/lib/firebase";
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  // Dynamically import leaflet on the client to avoid SSR/require usage
  import("leaflet")
    .then((_L) => {
      L = _L as unknown as typeof import("leaflet");
      try {
        // some leaflet typings don't expose _getIconUrl; guard at runtime
        // @ts-ignore
        fdsadelete (_L as any).Icon.Default.prototype._getIconUrl;
      } catch {
        // ignore
      }
      try {
        (_L as any).Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      } catch {
        // ignore
      }
    })
    .catch(() => {
      // ignore
    });
}
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

interface Booking {
  id: string;
  hotelName: string;
  hotelLocation: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  guests: number;
  totalPrice: number;
  hotelImage?: string;
  lat?: number;
  lon?: number;
  createdAt?: Timestamp;
  amenities?: string[];
  roomType?: string;
  availability?: number;
  price?: number;
  rating?: number;
  hotelId?: string;
}

interface Hotel {
  id: string;
  name: string;
  location: string;
  description?: string;
  price?: number;
  image?: string;
  amenities?: string[];
  latitude?: number;
  longitude?: number;
}

// Helper to reverse geocode
async function getExactAddress(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    );
    const data = await res.json();
    const addr = data.address;
    const parts = [
      addr.suburb || addr.neighbourhood || addr.village || addr.hamlet,
      addr.city || addr.town || addr.municipality || addr.village,
      "Batangas",
    ].filter(Boolean);
    return parts.join(", ");
  } catch (err) {
    console.error("Reverse geocode failed:", err);
    return "Batangas, Philippines";
  }
}

// AutoFitMap component to center map on coords
function AutoFitMap({ coords }: { coords: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    if (map && coords) {
      map.setView([coords.lat, coords.lon], 15, { animate: true });
      setTimeout(() => {
        map.invalidateSize(); // ensures marker renders correctly
      }, 100);
    }
  }, [map, coords]);
  return null;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<Hotel[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [acceptedHotelIds, setAcceptedHotelIds] = useState<string[]>([]);
  const [acceptedNameLocationKeys, setAcceptedNameLocationKeys] = useState<string[]>([]);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingInfo, setPendingInfo] = useState<any | null>(null);

  const [infoBooking, setInfoBooking] = useState<Booking | null>(null);
  const [mapBooking, setMapBooking] = useState<Booking | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [mapAddress, setMapAddress] = useState<string>("");
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [editFormData, setEditFormData] = useState<{
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    roomType: string;
    totalPrice: number;
  } | null>(null);
  const [cancelConfirmBooking, setCancelConfirmBooking] = useState<Booking | null>(null);
  const [withdrawConfirmPending, setWithdrawConfirmPending] = useState<any | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any | null>(null);
  const [approvedHotels, setApprovedHotels] = useState<Hotel[]>([]);
  const [loadingApproved, setLoadingApproved] = useState(true);

  const db = getFirestore(app);

  // Save a rating for a booking (updates the bookings doc with `rating`)
  const handleSaveRating = async (bookingId: string | undefined, rating: number) => {
    if (!bookingId) return;
    if (!user?.uid) return alert("Please sign in to leave a review");

    try {
      // update bookings doc with rating and reviewedAt
      await updateDoc(doc(db, "bookings", bookingId), {
        rating,
        reviewedAt: Timestamp.now(),
        reviewerId: user.uid,
      });

      // update local state so UI reflects change immediately
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, rating } : b)));
    } catch (err) {
      console.error("Failed to save rating:", err);
      alert("Failed to save rating. Please try again.");
    }
  };

  // After saving a booking rating, update the related hotel's aggregated rating and review count
  // This is best-effort: if we can identify the hotel (via booking.hotelId or matching name/coords)
  // we read the hotel's current `rating` and `reviewCount` and update them accordingly.
  const handleSaveRatingWithHotelUpdate = async (bookingId: string | undefined, rating: number) => {
    // First save the booking rating
    await handleSaveRating(bookingId, rating);

    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;

      const oldRating = booking.rating;

      // Determine hotel document reference: prefer explicit hotelId when present
      let hotelDocRef: any = null;
      if (booking.hotelId) {
        hotelDocRef = doc(db, "hotels", booking.hotelId);
      } else {
        // Try to find a matching hotel by name and coords (best-effort)
        try {
          const q = query(
            collection(db, "hotels"),
            where("name", "==", booking.hotelName)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            // choose the hotel that matches coords if available
            let chosen: any = snap.docs[0];
            if (booking.lat != null && booking.lon != null) {
              for (const d of snap.docs) {
                const data = d.data() as any;
                const lat = data.latitude ?? data.lat ?? data.locationLat ?? null;
                const lon = data.longitude ?? data.lon ?? data.locationLon ?? null;
                if (lat === booking.lat && lon === booking.lon) {
                  chosen = d;
                  break;
                }
              }
            }
            hotelDocRef = doc(db, "hotels", chosen.id);
          }
        } catch (e) {
          console.warn("Failed to find hotel for rating aggregation:", e);
        }
      }

      if (!hotelDocRef) return;

      // Read current hotel aggregate values
      try {
        const hotelSnap = await getDoc(hotelDocRef as any);
        if (!hotelSnap.exists()) return;
        const h = hotelSnap.data() as any;
        const currentAvg = Number(h.rating ?? h.avgRating ?? 0);
        const count = Number(h.reviewCount ?? h.reviews ?? 0);

        let newCount = count;
        let newAvg = currentAvg;

        if (oldRating === undefined || oldRating === null) {
          // new review
          newCount = count + 1;
          newAvg = (currentAvg * count + rating) / newCount;
        } else {
          // updating existing review: adjust average without changing count
          if (count <= 0) {
            newCount = 1;
            newAvg = rating;
          } else {
            newAvg = (currentAvg * count - oldRating + rating) / count;
          }
        }

        await updateDoc(hotelDocRef as any, {
          rating: Number(newAvg.toFixed(1)),
          reviewCount: newCount,
        });
      } catch (e) {
        console.warn("Failed to update hotel aggregates:", e);
      }
    } catch (e) {
      // already logged in inner blocks
    }
  };

  // Simple clickable star rating component
  function StarRating({ bookingId, initial = 0, small = false }: { bookingId?: string | null; initial?: number | null; small?: boolean }) {
    const [value, setValue] = useState<number>(initial ?? 0);
    const [hover, setHover] = useState<number>(0);

    // reflect external updates
    useEffect(() => {
      setValue(initial ?? 0);
    }, [initial]);

    // larger default size for more prominent stars
    const sizeClass = small ? "text-base" : "text-3xl";

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i} star`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={async () => {
                setValue(i);
                await handleSaveRatingWithHotelUpdate(bookingId ?? undefined, i);
              }}
              className={`focus:outline-none leading-none ${sizeClass} ${((hover || value) >= i) ? "text-yellow-400" : "text-zinc-300"}`}
            >
              ★
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-600">{value > 0 ? `${value}.0` : "No rating"}</div>
      </div>
    );
  }

  // Resolve image paths stored in bookings/hotels to public/ when a filename is used
  const resolveImageSrc = (url?: string | null) => {
    if (!url) return "/taal-gold.avif";
    try {
      const s = String(url);
      if (s.startsWith("http") || s.startsWith("/") || s.startsWith("data:")) return s;
      return `/${s}`;
    } catch {
      return "/taal-gold.avif";
    }
  };

  // Displayed pending list: prefer current state, but fall back to localStorage
  // so that items removed from the server (e.g., rejected by admin) remain
  // visible in the user's Hotel Requests list.
  const getSavedPending = () => {
    try {
      const saved = localStorage.getItem("hotbook_pendingList_v1");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const displayedPending = (pendingList && pendingList.length > 0) ? pendingList : getSavedPending();

  // Fetch bookings from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setLoadingBookings(false);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // DEBUG: print current user email and raw snapshot docs to help diagnose missing bookings
        try {
          // debug logging removed
        } catch (e) {
          // ignore
        }

        const data = snapshot.docs.map((d) => {
          const raw = d.data() as any;
          // Normalize booking fields from different writers/components
          const booking: Booking = {
            id: d.id,
            hotelName: raw.hotelName || raw.hotel?.name || raw.hotel?.hotelName || raw.name || "Unknown Hotel",
            hotelLocation:
              raw.hotelLocation || raw.hotel?.location || raw.hotel?.address || raw.address || "",
            checkInDate: raw.checkIn || raw.checkInDate || raw.checkInDateISO || "",
            checkOutDate: raw.checkOut || raw.checkOutDate || raw.checkOutDateISO || "",
            guests: raw.guests || raw.partySize || 1,
            totalPrice: raw.totalPrice || raw.price || 0,
            hotelImage: raw.hotelImage || raw.image || raw.hotel?.imageUrl,
            lat: raw.hotelCoordinates?.latitude || raw.lat || raw.latitude,
            lon: raw.hotelCoordinates?.longitude || raw.lon || raw.longitude,
            createdAt: (raw.createdAt as any) || (raw.bookingDate ? Timestamp.fromDate(new Date(raw.bookingDate)) : undefined),
            roomType: raw.roomType || raw.roomTypeName,
            availability: raw.availability,
            price: raw.price,
            rating: raw.rating ?? undefined,
            hotelId: raw.hotelId || raw.hotel?.id || raw.hotel_id || undefined,
          } as Booking;

          return booking;
        });

        setBookings(data);
        setLoadingBookings(false);

      },
      (error: FirestoreError) => {
        console.error("Firestore snapshot error:", error);
        setLoadingBookings(false);
        if (error.code === "failed-precondition") {
          setFetchError(
            "Firestore index required for this query is missing. Please create it in Firebase console."
          );
        } else {
          setFetchError("Failed to fetch bookings. Please try again later.");
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid, db]);

  // Load favorites from localStorage
  useEffect(() => {
    setLoadingFavorites(true);
    const saved = localStorage.getItem("savedHotels");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to parse saved hotels:", error);
        setFavorites([]);
      }
    }
    setLoadingFavorites(false);
  }, []);

  // Fetch pending submissions for the current user (from in-memory API)
  useEffect(() => {
    if (!user?.email) {
      setPendingList([]);
      try {
        localStorage.removeItem("hotbook_pendingList_v1");
      } catch (e) {
        // ignore
      }
      return;
    }

    let mounted = true;
    // hydrate from localStorage first so items persist across reloads
    try {
      const saved = localStorage.getItem("hotbook_pendingList_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setPendingList(parsed);
      }
    } catch (e) {
      // ignore parse errors
    }

    const fetchPending = async () => {
      try {
        const res = await fetch('/api/pending');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const mine = Array.isArray(data) ? data.filter((i: any) => i.submitterEmail === user.email) : [];

        // Keep all of the user's pending submissions visible in the dashboard.
        // We still fetch the current hotels and record their ids so the UI can
        // show an "Accepted" state for any pending submission that was approved
        // (even if the approved hotel was created with a different id).
        try {
          const snap = await getDocs(query(collection(db, "hotels"), orderBy("name", "asc")) as any);
          if (!mounted) return;

          // Use local variables (not immediate state) when computing accepted
          // ids/keys so we don't rely on setState being processed synchronously.
          const ids = snap.docs.map((d) => d.id);
          const keySet = new Set<string>();
          snap.docs.forEach((d) => {
            const dt = d.data() as any;
            const name = (dt.name || "").toString().trim().toLowerCase();
            const location = (dt.location || "").toString().trim().toLowerCase();
            if (name || location) keySet.add(`${name}:::${location}`);
          });

          // update React state for other consumers, but use the local copies
          // below to compute statuses immediately.
          setAcceptedHotelIds(ids);
          setAcceptedNameLocationKeys(Array.from(keySet));

          // Keep the full pending list. Merge server-provided results with any
          // locally-known submissions so approved/rejected items are not
          // removed from the user's view even if the server stops returning
          // them. This preserves the requested UX: submissions remain in the
          // pending list and simply change their status to 'Accepted'/'Rejected'.
          // Always include locally-saved pending items so server-side deletes
          // (e.g. admin rejection) don't cause the user's copy to vanish.
          const savedPending = (() => {
            try {
              const raw = localStorage.getItem('hotbook_pendingList_v1');
              if (!raw) return [];
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })();

          const existing = Array.isArray(pendingList) ? pendingList : [];
          const merged = (() => {
            const map = new Map<string, any>();
            // seed with locally-saved items first (preserve user copy)
            for (const pItem of savedPending) map.set(String(pItem.id), { ...pItem });
            // then include current in-memory items
            for (const pItem of existing) map.set(String(pItem.id), { ...pItem });
            // finally include server-provided items (they override local copies)
            for (const sItem of (mine || [])) map.set(String(sItem.id), { ...sItem });
            return Array.from(map.values());
          })();

          // Determine statuses using our local arrays (ids, keyArray)
          const keyArray = Array.from(keySet);
          const mineIds = new Set((mine || []).map((x: any) => String(x.id)));
          const updated = merged.map((item: any) => {
            const idStr = String(item.id);
            const nameKey = `${(item.name||"").toString().trim().toLowerCase()}:::${(item.location||"").toString().trim().toLowerCase()}`;
            const isAcceptedByKey = keyArray.includes(nameKey);
            if (ids.includes(idStr) || isAcceptedByKey || item.status === 'accepted' || item.accepted === true) {
              item.status = 'accepted';
            } else if (!mineIds.has(idStr)) {
              // server no longer returns it and it's not accepted => rejected
              item.status = 'rejected';
            } else {
              item.status = item.status || 'pending';
            }
            return item;
          });

          setPendingList(updated);
          try {
            // persist the updated list (with computed statuses)
            localStorage.setItem("hotbook_pendingList_v1", JSON.stringify(updated));
          } catch (e) {
            // ignore storage errors
          }
        } catch (err) {
          console.warn('Failed to fetch hotels for accepted check', err);
          // If we can't fetch hotels, still show the raw pending list.
          // Merge with previous items so we don't remove submissions
          // that the server may have stopped returning after approval.
          setAcceptedHotelIds([]);
          const existing = pendingList || [];
          const merged = (() => {
            const map = new Map<string, any>();
            for (const pItem of existing) map.set(String(pItem.id), { ...pItem });
            for (const sItem of (mine || [])) map.set(String(sItem.id), { ...sItem });
            return Array.from(map.values());
          })();

          const mineIds = new Set((mine || []).map((x: any) => String(x.id)));
          const updated = merged.map((item: any) => {
            const idStr = String(item.id);
            const nameKey = `${(item.name||"").toString().trim().toLowerCase()}:::${(item.location||"").toString().trim().toLowerCase()}`;
            const isAcceptedByKey = acceptedNameLocationKeys.includes(nameKey);
            if (acceptedHotelIds.includes(idStr) || isAcceptedByKey || item.status === 'accepted' || item.accepted === true) {
              item.status = 'accepted';
            } else if (!mineIds.has(idStr)) {
              item.status = 'rejected';
            } else {
              item.status = item.status || 'pending';
            }
            return item;
          });

          setPendingList(updated);
          try {
            localStorage.setItem("hotbook_pendingList_v1", JSON.stringify(updated));
          } catch (e) {
            // ignore
          }
        }
      } catch (err) {
        console.warn('Failed to fetch pending items', err);
      }
    };

    fetchPending();
    const onPendingWithDetail = (ev: Event) => {
      // New pending or hotel added: re-fetch to pick up new approvals.
      fetchPending();
    };

    // Immediate event handler: mark a specific pending item as updated/removed
    // so the dashboard reflects a 'rejected' state instantly without waiting
    // for the fetch. This keeps the user's submission visible and changes the
    // status to the provided status (default 'rejected').
    const onPendingEventImmediate = (ev: Event) => {
      try {
        const detail = (ev as any)?.detail || {};
        const id = detail && detail.id ? String(detail.id) : null;
        const status = detail && detail.status ? String(detail.status) : 'rejected';
        if (!id) return;

        setPendingList((prev: any[]) => {
          const prevArr = Array.isArray(prev) ? prev.slice() : [];
          let found = false;
          const updated = prevArr.map((item) => {
            if (String(item.id) === id) {
              found = true;
              return { ...item, status, rejected: status === 'rejected', accepted: status === 'accepted' };
            }
            return item;
          });

          if (!found) {
            // Try to restore from localStorage if available, otherwise create
            // a minimal placeholder so the user still sees the rejected item.
            try {
              const saved = JSON.parse(localStorage.getItem('hotbook_pendingList_v1') || '[]');
              const existing = Array.isArray(saved) ? saved.find((s: any) => String(s.id) === id) : null;
              if (existing) {
                existing.status = status;
                existing.rejected = status === 'rejected';
                existing.accepted = status === 'accepted';
                updated.push(existing);
              } else {
                updated.push({ id, status, rejected: status === 'rejected' });
              }
            } catch (e) {
              updated.push({ id, status, rejected: status === 'rejected' });
            }
          }

          try { localStorage.setItem('hotbook_pendingList_v1', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      } catch (e) {
        // ignore
      } finally {
        // still re-fetch in the background to reconcile with server
        fetchPending();
      }
    };

    window.addEventListener('hotbook:pending-hotel-added', onPendingWithDetail);
    window.addEventListener('hotbook:hotel-added', onPendingWithDetail);
    window.addEventListener('hotbook:pending-hotel-removed', onPendingEventImmediate);
    window.addEventListener('hotbook:pending-hotel-updated', onPendingEventImmediate);

    // Also watch the hotels collection so approvals made from other browsers/clients
    // will cause this client to refresh pending items.
    let hotelsUnsub: (() => void) | null = null;
    try {
      const hotelsCol = collection(db, "hotels");
      hotelsUnsub = onSnapshot(hotelsCol, () => {
        fetchPending();
      });
    } catch (err) {
      // ignore snapshot errors (permissions etc.)
      console.warn('Failed to subscribe to hotels snapshot:', err);
    }

    return () => {
      mounted = false;
      window.removeEventListener('hotbook:pending-hotel-added', onPendingWithDetail);
      window.removeEventListener('hotbook:hotel-added', onPendingWithDetail);
      window.removeEventListener('hotbook:pending-hotel-removed', onPendingWithDetail);
      window.removeEventListener('hotbook:pending-hotel-updated', onPendingWithDetail);
      if (hotelsUnsub) hotelsUnsub();
    };
  }, [user?.email]);

  // Fetch hotels that were approved/published and are associated with this user
  useEffect(() => {
    let mounted = true;
    const fetchApproved = async () => {
      if (!user?.email) {
        setApprovedHotels([]);
        setLoadingApproved(false);
        return;
      }
      setLoadingApproved(true);
      try {
        const snap = await getDocs(collection(db, "hotels"));
        if (!mounted) return;
        const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        // Select hotels that were actually created/submitted by this user.
        // We include hotels where `submitterEmail` matches the current user
        // and hotels that reference a pending id belonging to this user.
        const mine = all.filter((h: any) => {
          const submitter = (h.submitterEmail || "").toString().toLowerCase();
          if (submitter && user?.email && submitter === user.email.toLowerCase()) return true;

          // also consider the hotels that reference pending ids belonging to this user
          const pendingIds = [h.pendingId, h.originalPendingId, h.sourcePendingId, h.pendingSubmissionId, h.pending_id];
          for (const pid of pendingIds) {
            if (pid && pendingList.some((p) => String(p.id) === String(pid))) return true;
          }

          // Do NOT attempt a loose name/location fallback here — that may
          // incorrectly match hotels created by other users. Only include
          // hotels that explicitly reference this user's email or a pending
          // submission id we control.
          return false;
        });

        setApprovedHotels(mine as Hotel[]);
      } catch (err) {
        console.warn('Failed to fetch approved hotels', err);
        setApprovedHotels([]);
      } finally {
        if (mounted) setLoadingApproved(false);
      }
    };

    fetchApproved();
    // re-run when pendingList or acceptedNameLocationKeys change
    return () => { mounted = false; };
  }, [user?.email, pendingList, acceptedNameLocationKeys, db]);

  const removeFavorite = (hotelId: string) => {
    const updated = favorites.filter((h) => h.id !== hotelId);
    setFavorites(updated);
    localStorage.setItem("savedHotels", JSON.stringify(updated));
    
    // Also remove from favorites IDs list in hotels page
    const favoriteIds: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
    const updatedIds = favoriteIds.filter((id) => id !== hotelId);
    localStorage.setItem("favorites", JSON.stringify(updatedIds));
  };

  // Fetch coordinates for map modal
  useEffect(() => {
    if (!mapBooking) return;

    const fetchCoords = async () => {
      if (mapBooking.lat && mapBooking.lon) {
        setMapCoords({ lat: mapBooking.lat, lon: mapBooking.lon });
        setMapAddress(mapBooking.hotelLocation);
      } else if (mapBooking.hotelLocation) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              mapBooking.hotelLocation
            )}`
          );
          const data = await res.json();
          if (data.length > 0) {
            setMapCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
            const address = await getExactAddress(parseFloat(data[0].lat), parseFloat(data[0].lon));
            setMapAddress(address);
          } else {
            setMapCoords(null);
            setMapAddress(mapBooking.hotelLocation);
          }
        } catch (err) {
          console.error(err);
          setMapCoords(null);
          setMapAddress(mapBooking.hotelLocation);
        }
      }
    };

    fetchCoords();
  }, [mapBooking]);

  // Initialize edit form when editBooking is opened
  useEffect(() => {
    if (editBooking) {
      setEditFormData({
        checkInDate: editBooking.checkInDate,
        checkOutDate: editBooking.checkOutDate,
        guests: editBooking.guests,
        roomType: editBooking.roomType || "Standard",
        totalPrice: editBooking.totalPrice,
      });
    }
  }, [editBooking]);

  // Calculate price based on nights and selected room type
  // roomType modifiers: Standard = +0, Deluxe = +500 per night, Suite = +1500 per night
  const calculatePrice = (
    checkIn: string,
    checkOut: string,
    basePrice: number,
    roomType: string = "Standard"
  ) => {
    if (!checkIn || !checkOut) return basePrice;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return basePrice;

    // Determine price per night. If an existing booking total exists, derive per-night
    const pricePerNight = (editBooking?.totalPrice || basePrice) /
      (editBooking ? Math.max(1, Math.ceil((new Date(editBooking.checkOutDate).getTime() - new Date(editBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))) : 1);

    // Apply room type modifier (treated as per-night additive)
    let modifierPerNight = 0;
    const rt = (roomType || "Standard").toString().toLowerCase();
    if (rt === "deluxe") modifierPerNight = 500;
    else if (rt === "suite") modifierPerNight = 1500;

    return Math.round((pricePerNight + modifierPerNight) * nights);
  };

  // Withdraw pending submission (called from confirmation modal)
  const withdrawPending = async (p: any) => {
    if (!p) return;
    let deletedLocally = false;
    try {
      const res = await fetch(`/api/pending/${p.id}`, { method: 'DELETE' });
      // treat 404 (already removed) as OK — proceed with cleanup
      if (res.ok || res.status === 404) {
        deletedLocally = true;
      } else {
        console.warn('Pending DELETE returned non-ok status', res.status);
      }
    } catch (err) {
      console.warn('Pending DELETE request failed', err);
    }

    // Instead of removing the pending item from the UI, mark it as rejected
    // so the user still sees their submission but with an updated status.
    if (deletedLocally) {
      setPendingList((prev) => {
        const updated = (prev || []).map((x) => {
          if (String(x.id) === String(p.id)) {
            return { ...x, status: 'rejected', rejected: true };
          }
          return x;
        });
        try { localStorage.setItem("hotbook_pendingList_v1", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

      // Server-side: ensure pending entries are cleaned up
      try {
        await fetch(`/api/pending/ensure-delete`, {
          method: 'POST',
          body: JSON.stringify({ id: p.id, name: p.name, location: p.location }),
          headers: { 'content-type': 'application/json' },
        });
      } catch (e) {
        console.warn('ensure-delete request failed', e);
      }

      // NOTE: we intentionally do NOT delete any published hotel documents
      // from Firestore when a user withdraws their pending submission from
      // their dashboard. Removing published hotel entries should be an
      // administrative action. Here we only remove/mark the user's local
      // pending copy and call the ensure-delete API which performs safe
      // server-side cleanup as appropriate.

      // notify other clients that the pending item was updated (withdrawn)
      try {
        window.dispatchEvent(new CustomEvent('hotbook:pending-hotel-updated', { detail: { id: p.id, status: 'rejected' } }));
      } catch (e) {
        // ignore
      }
  };

  // NOTE: the previous `deleteAccepted` helper (which removed published
  // hotel documents from Firestore) has been intentionally removed to
  // prevent users from accidentally deleting approved/published hotel
  // entries. Published hotel deletion should be an administrative
  // operation. Use `withdrawPending` to withdraw the user's submission
  // from their dashboard without removing public records.

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) redirect("/");

  const upcomingBooking = bookings[0];

  return (
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Header / hero */}
        <motion.div
          className="flex flex-col justify-between gap-4 rounded-3xl border border-[#8FABD4]/40 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-[#8FABD4]/40 dark:bg-zinc-900/90 md:flex-row md:items-center"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#4A70A9] dark:text-[#8FABD4]">My travel</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#000000] dark:text-zinc-50 md:text-4xl">
              Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-400">
              View upcoming stays, manage your bookings, and keep your favourite hotels in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-stretch text-xs md:text-sm">
            <Card className="border-none bg-[#8FABD4]/25 px-3 py-3 shadow-none dark:bg-[#4A70A9]/40 h-full flex flex-col">
              <CardHeader className="p-0 pb-1 flex-none">
                <CardTitle className="text-[11px] font-medium text-[#4A70A9] dark:text-[#EFECE3]">
                  Upcoming stay
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-[13px] font-semibold text-[#000000] dark:text-[#EFECE3] flex-1 flex items-center">
                <div className="w-full">{upcomingBooking ? upcomingBooking.hotelName : "No trips yet"}</div>
              </CardContent>
            </Card>

            <Card className="border-none bg-[#EFECE3] px-3 py-3 shadow-none dark:bg-[#4A70A9] h-full flex flex-col">
              <CardHeader className="p-0 pb-1 flex-none">
                <CardTitle className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  Total bookings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-[20px] font-semibold text-[#000000] dark:text-zinc-50 flex-1 flex items-center justify-center">
                <div className="w-full text-center text-[20px] leading-none">{bookings.length}</div>
              </CardContent>
            </Card>

              <div className="flex flex-col gap-3">
              <Card className="border-none bg-[#4A70A9]/10 px-3 py-3 shadow-none dark:bg-[#4A70A9]/35 h-full flex flex-col">
                <CardHeader className="p-0 pb-1 flex-none">
                  <CardTitle className="text-[11px] font-medium text-[#4A70A9] dark:text-[#EFECE3]">
                    Saved hotels
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-[20px] font-semibold text-[#4A70A9] dark:text-[#EFECE3] flex-1 flex items-center justify-center">
                  <div className="w-full text-center text-[20px] leading-none">{favorites.length}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>

        {/* Hotel requests dialog for user's submissions */}
        <Dialog open={pendingDialogOpen} onOpenChange={() => setPendingDialogOpen(false)}>
          <DialogContent className="w-[90vw] max-w-2xl p-4">
            <DialogHeader>
              <DialogTitle>Your hotel requests</DialogTitle>
            </DialogHeader>
            {pendingList.length === 0 ? (
              <p className="text-sm text-zinc-600">You have no hotel requests.</p>
            ) : (
              <div className="grid gap-3">
                {pendingList.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-zinc-600">{p.location}</p>
                        <p className="text-xs text-zinc-500">Submitted: {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <div>{typeof p.price === 'number' ? `₱${p.price.toLocaleString()}` : (p.price ? `₱${p.price}` : 'N/A')}</div>
                        <div className="text-xs text-zinc-500">Rooms: {p.roomsAvailable ?? 'N/A'}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Hotel Request Info Modal */}
        <Dialog open={!!pendingInfo} onOpenChange={() => setPendingInfo(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{pendingInfo?.name || 'Hotel request'}</DialogTitle>
            </DialogHeader>

            {pendingInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <div className="h-40 w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    {pendingInfo.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveImageSrc(pendingInfo.image)}
                          alt={pendingInfo.name}
                          onError={(e) => {
                            const t = e.currentTarget as HTMLImageElement;
                            if (t.src && !t.src.endsWith('/taal-gold.avif')) t.src = '/taal-gold.avif';
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                      <div className="text-sm text-zinc-500">No image available</div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <p className="text-sm text-zinc-500">Location</p>
                  <p className="font-medium">{pendingInfo.location}</p>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-sm text-zinc-500">Price</p>
                      <p className="font-medium">{typeof pendingInfo.price === 'number' ? `₱${pendingInfo.price.toLocaleString()}` : (pendingInfo.price ? `₱${pendingInfo.price}` : 'N/A')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Rooms</p>
                      <p className="font-medium">{pendingInfo.roomsAvailable ?? 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Submitted</p>
                      <p className="font-medium">{pendingInfo.createdAt ? new Date(pendingInfo.createdAt).toLocaleString() : '—'}</p>
                    </div>
                  </div>

                  {pendingInfo.amenities && pendingInfo.amenities.length > 0 && (
                    <div>
                      <p className="text-sm text-zinc-500 mb-2">Amenities</p>
                      <div className="flex flex-wrap gap-2">
                        {pendingInfo.amenities.map((a: string, i: number) => (
                          <Badge key={i}>{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingInfo.description && (
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Description</p>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{pendingInfo.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <motion.div initial="initial" animate="animate" variants={fadeInUp} transition={{ delay: 0.1 }}>
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="mb-6 grid w-full max-w-md grid-cols-3 gap-2 rounded-full bg-[#EFECE3] p-1 dark:bg-zinc-900/80">
              <TabsTrigger value="bookings" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-white data-[state=active]:text-[#000000]
                  dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                My Bookings
              </TabsTrigger>
              <TabsTrigger value="favorites" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-white data-[state=active]:text-[#000000]
                  dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                Saved Hotels
              </TabsTrigger>
              
              <TabsTrigger value="pending" className="w-full h-full flex items-center justify-center text-center
                  data-[state=active]:bg-white data-[state=active]:text-[#000000]
                  dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white
                  rounded-full text-sm font-medium transition-all duration-300">
                Hotel Requests
              </TabsTrigger>
            </TabsList>

            

            {/* Bookings Tab */}
            <TabsContent value="bookings" className="space-y-4">
              {loadingBookings ? (
                <div className="flex justify-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
                </div>
              ) : fetchError ? (
                <Card className="border-2 border-gray-200 dark:border-zinc-700">
                  <CardHeader>
                    <CardTitle>Error Loading Bookings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-600 dark:text-red-400">{fetchError}</p>
                  </CardContent>
                </Card>
              ) : bookings.length === 0 ? (
                <Card className="border border-dashed border-zinc-300 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <CardHeader>
                    <CardTitle>My Bookings</CardTitle>
                    <CardDescription>View and manage your hotel reservations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">No bookings yet</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500">
                        Start exploring hotels and make your first booking
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {bookings.map((booking) => (
                    <motion.div key={booking.id} variants={staggerItem}>
                      <Card className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base font-semibold md:text-lg">
                                {booking.hotelName}
                              </CardTitle>
                              <Badge variant="outline" className="text-[11px]">
                                {booking.roomType || "Standard room"}
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center text-xs text-zinc-500 dark:text-zinc-400">
                              <MapPin className="mr-1.5 h-3.5 w-3.5" />
                              <span className="line-clamp-1">
                                {booking.hotelLocation || "Batangas, Philippines"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300 md:mt-0 md:w-64">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>
                                {booking.checkInDate} → {booking.checkOutDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User2 className="h-3.5 w-3.5" />
                              <span>{booking.guests} guest{booking.guests > 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 md:min-w-[220px]">
                          <div className="flex items-center gap-3 mb-1">
                            <div>
                              <StarRating bookingId={booking.id} initial={(booking as any)?.rating ?? 0} small />
                            </div>
                            <div className="text-right text-xs text-zinc-600 dark:text-zinc-300">
                              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Total</p>
                              <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                ₱{booking.totalPrice.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInfoBooking({ ...booking, hotelImage: resolveImageSrc(booking.hotelImage) })}
                            >
                              Info
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMapBooking(booking)}
                            >
                              Map
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditBooking(booking)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setCancelConfirmBooking(booking)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="space-y-4">
              {loadingFavorites ? (
                <div className="flex justify-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
                </div>
              ) : favorites.length === 0 ? (
                <Card className="border border-dashed border-[#8FABD4]/60 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-[#000000] dark:text-zinc-50">Saved Hotels</CardTitle>
                    <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400">
                      Your favourite places to stay, all in one place.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="py-10 text-center">
                      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">No saved hotels yet</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Tap the heart on any hotel to keep it here for later.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="initial" animate="animate">
                  {favorites.map((hotel) => (
                    <motion.div key={hotel.id} variants={staggerItem}>
                      <Card className="flex h-full flex-col overflow-hidden rounded-xl border border-[#8FABD4]/40 bg-white/90 shadow-sm dark:border-[#8FABD4]/40 dark:bg-zinc-900/90">
                        <div className="h-32 w-full overflow-hidden">
                          <img
                            src={hotel.image || "/placeholder.jpg"}
                            alt={hotel.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-[#000000] dark:text-zinc-50">
                            {hotel.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400">
                            {hotel.location}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-zinc-600">{hotel.description || ''}</p>

                          {hotel.amenities && hotel.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {hotel.amenities.map((amenity, idx) => (
                                <Badge key={idx} variant="outline" className="border-[#8FABD4]/50 bg-[#8FABD4]/10 px-2 py-0 text-[10px] font-normal text-[#4A70A9] dark:border-[#8FABD4]/70 dark:bg-[#4A70A9]/25 dark:text-[#EFECE3]">
                                  {amenity}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {hotel.price
                              ? `₱${hotel.price.toLocaleString()} per night`
                              : "Price not available"}
                          </p>
                          <div className="flex items-center justify-between pt-3">
                            <button
                              onClick={() => {
                                if (hotel.latitude && hotel.longitude) {
                                  setMapBooking({
                                    id: hotel.id,
                                    hotelName: hotel.name,
                                    hotelLocation: hotel.location,
                                    checkInDate: new Date().toISOString().split('T')[0],
                                    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                                    guests: 2,
                                    totalPrice: hotel.price || 0,
                                    lat: hotel.latitude,
                                    lon: hotel.longitude,
                                  });
                                  setMapCoords({ lat: hotel.latitude, lon: hotel.longitude });
                                  setMapAddress(hotel.location);
                                }
                              }}
                              className="rounded-full bg-[#EFECE3] px-3 py-1 text-[11px] text-zinc-800 hover:bg-[#E0DCCF] dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            >
                              View Map
                            </button>
                            <div className="flex gap-2">
                              <button
                                onClick={() => removeFavorite(hotel.id)}
                                className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => {
                                  try {
                                    // Save a minimal selectedHotel object for the booking page fallback
                                    const selected = {
                                      id: hotel.id,
                                      name: hotel.name,
                                      latitude: hotel.latitude,
                                      longitude: hotel.longitude,
                                      address: hotel.location,
                                      imageUrl: hotel.image,
                                      price: hotel.price,
                                      amenities: hotel.amenities,
                                      description: hotel.description,
                                    };
                                    localStorage.setItem("selectedHotel", JSON.stringify(selected));
                                  } catch (e) {
                                    // ignore storage errors
                                  }
                                  router.push(`/booking/${hotel.id}`);
                                }}
                                className="rounded-full bg-[#4A70A9] px-4 py-1 text-[11px] font-medium text-white hover:bg-[#4A70A9]/90"
                              >
                                Book
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* Hotel Requests Tab (replaces Profile) */}
            <TabsContent value="pending" className="space-y-4">
              <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                <Card className="border border-transparent">
                  <CardHeader>
                    <CardTitle>My Hotel Requests</CardTitle>
                    <CardDescription>Hotel requests you submitted that are awaiting admin verification</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {displayedPending.length === 0 ? (
                      <p className="text-sm text-zinc-600">You have no hotel requests.</p>
                    ) : (
                      <div className="grid gap-3">
                        {displayedPending.map((p: any) => {
                          const lat = p.latitude ?? p.lat ?? p.latitude;
                          const lon = p.longitude ?? p.lon ?? p.longitude;
                            return (
                            <Card key={p.id}>
                              <CardContent className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold">{p.name}</p>
                                  <p className="text-sm text-zinc-600">{p.location}</p>
                                  <p className="text-xs text-zinc-500">Submitted: {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</p>
                                </div>

                                <div className="mx-4 flex items-center justify-center min-w-24">
                                  {((p && (p.status === 'rejected' || p.rejected === true)) ) ? (
                                    <span className="text-rose-600 font-semibold text-sm">Rejected</span>
                                  ) : (() => {
                                    const nameKey = `${(p.name||"").toString().trim().toLowerCase()}:::${(p.location||"").toString().trim().toLowerCase()}`;
                                    const isAcceptedByKey = acceptedNameLocationKeys.includes(nameKey);
                                    const isAcceptedFlag = p && (p.status === 'accepted' || p.accepted === true);
                                    if (acceptedHotelIds.includes(String(p.id)) || isAcceptedByKey || isAcceptedFlag) {
                                      return <span className="text-green-600 font-semibold text-sm">Approved</span>;
                                    }
                                    return <span className="text-amber-600 font-semibold text-sm">Pending</span>;
                                  })()}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    aria-label="Delete submission"
                                    title="Delete submission"
                                    className="text-zinc-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                    onClick={() => setDeleteConfirmItem(p)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    aria-label="View Map"
                                    title="View Map"
                                    className="p-2"
                                    onClick={async () => {
                                      const bookingLike = {
                                        id: p.id,
                                        hotelName: p.name,
                                        hotelLocation: p.location,
                                        checkInDate: new Date().toISOString().split("T")[0],
                                        checkOutDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                                        guests: 1,
                                        totalPrice: p.price || 0,
                                        hotelImage: p.image || p.photo || undefined,
                                        lat: lat,
                                        lon: lon,
                                      } as Booking;
                                      setMapBooking(bookingLike);
                                      if (lat && lon) {
                                        setMapCoords({ lat: Number(lat), lon: Number(lon) });
                                        setMapAddress(p.location || "");
                                      } else {
                                        try {
                                          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                                            p.location || ""
                                          )}`);
                                          const data = await res.json();
                                          if (data.length > 0) {
                                            const la = parseFloat(data[0].lat);
                                            const lo = parseFloat(data[0].lon);
                                            setMapCoords({ lat: la, lon: lo });
                                            setMapAddress(await getExactAddress(la, lo));
                                          } else {
                                            setMapCoords(null);
                                            setMapAddress(p.location || "");
                                          }
                                        } catch (err) {
                                          console.warn('Geocode failed', err);
                                          setMapCoords(null);
                                          setMapAddress(p.location || "");
                                        }
                                      }
                                    }}
                                  >
                                    <MapPin className="h-4 w-4" />
                                  </Button>

                                  <Button size="sm" variant="outline" aria-label="Info" title="Info" className="p-2" onClick={() => setPendingInfo(p)}>
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Info Modal */}
        <Dialog open={!!infoBooking} onOpenChange={() => setInfoBooking(null)}>
          <DialogContent className="max-w-3xl" showCloseButton={false}>
            <div className="flex items-start justify-between">
                <div>
                <h3 className="text-lg font-semibold">{infoBooking?.hotelName}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{infoBooking?.hotelLocation}</p>
                <div className="mt-2">
                  <StarRating bookingId={infoBooking?.id} initial={(infoBooking as any)?.rating ?? 0} small />
                </div>
              </div>
              <div>
                <button
                  onClick={() => setInfoBooking(null)}
                  aria-label="Close booking info"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>
            </div>

            {infoBooking && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <div className="h-40 w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    {infoBooking.hotelImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageSrc(infoBooking.hotelImage)}
                        alt={infoBooking.hotelName}
                        onError={(e) => {
                          const t = e.currentTarget as HTMLImageElement;
                          if (t.src && !t.src.endsWith('/taal-gold.avif')) t.src = '/taal-gold.avif';
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-sm text-zinc-500">No image available</div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm text-zinc-500">Check-in</p>
                      <p className="font-medium">{infoBooking.checkInDate} {infoBooking.checkInTime || ""}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Check-out</p>
                      <p className="font-medium">{infoBooking.checkOutDate} {infoBooking.checkOutTime || ""}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-sm text-zinc-500">Guests</p>
                      <p className="font-medium">{infoBooking.guests}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Room</p>
                      <p className="font-medium">{infoBooking.roomType || "Standard"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Total</p>
                      <p className="font-medium">₱{infoBooking.totalPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  {infoBooking.amenities && infoBooking.amenities.length > 0 && (
                    <div>
                      <p className="text-sm text-zinc-500 mb-2">Amenities</p>
                      <div className="flex flex-wrap gap-2">
                        {infoBooking.amenities.map((a, i) => (
                          <Badge key={i} variant="secondary">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* single top-close 'x' is used; no bottom Close button */}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Map Modal */}
        {mapBooking && L && mapCoords && (
          <Dialog open={!!mapBooking && !!mapCoords} onOpenChange={() => setMapBooking(null)}>
            <DialogContent className="max-w-4xl p-0" showCloseButton={false}>
              <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-zinc-900">
                <div>
                  <h3 className="text-lg font-semibold">{mapBooking.hotelName}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{mapAddress}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapCoords.lat},${mapCoords.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Open in Maps
                  </a>
                  <button onClick={() => setMapBooking(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">x</button>
                </div>
              </div>

              <div className="h-[480px] w-full">
                <MapContainer
                  center={[mapCoords.lat, mapCoords.lon]}
                  zoom={15}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <AutoFitMap coords={mapCoords} />
                  <Marker position={[mapCoords.lat, mapCoords.lon]}>
                    <Popup>
                      <div>
                        <h3 className="font-semibold">{mapBooking.hotelName}</h3>
                        <p className="text-sm text-zinc-500">{mapAddress}</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t bg-white dark:bg-zinc-900">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${mapCoords.lat},${mapCoords.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Directions
                </a>
                {/* single top-close 'x' is used; no bottom Close button */}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Booking Modal */}
        {editBooking && editFormData && (
          <Dialog open={!!editBooking} onOpenChange={() => setEditBooking(null)}>
            <DialogContent className="max-w-2xl" showCloseButton={false}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Update Booking</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{editBooking.hotelName}</p>
                  <div className="mt-2">
                    <StarRating bookingId={editBooking?.id} initial={(editBooking as any)?.rating ?? 0} small />
                  </div>
                </div>
                <button
                  onClick={() => setEditBooking(null)}
                  aria-label="Close edit modal"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="space-y-4 mt-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Check-in Date</label>
                    <input
                      type="date"
                      value={editFormData.checkInDate}
                      onChange={(e) => {
                        const newFormData = { ...editFormData, checkInDate: e.target.value };
                        setEditFormData(newFormData);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Check-out Date</label>
                    <input
                      type="date"
                      value={editFormData.checkOutDate}
                      onChange={(e) => {
                        const newFormData = { ...editFormData, checkOutDate: e.target.value };
                        setEditFormData(newFormData);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Number of Guests</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.guests}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, guests: parseInt(e.target.value) || editFormData.guests });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Room Type</label>
                    <select
                      value={editFormData.roomType}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, roomType: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Deluxe">Deluxe (+₱500/night)</option>
                      <option value="Suite">Suite (+₱1500/night)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Total Price (₱) - Auto-calculated</label>
                  <input
                    type="number"
                    disabled
                    value={calculatePrice(editFormData.checkInDate, editFormData.checkOutDate, editBooking?.price || 0, editFormData.roomType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-gray-100 dark:bg-zinc-700 text-black dark:text-white cursor-not-allowed opacity-60"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Price updates automatically based on check-in and check-out dates</p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditBooking(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={async () => {
                      try {
                        const calculatedPrice = calculatePrice(editFormData.checkInDate, editFormData.checkOutDate, editBooking?.price || 0, editFormData.roomType);
                        const bookingRef = doc(db, "bookings", editBooking.id);
                        await updateDoc(bookingRef, {
                          checkInDate: editFormData.checkInDate,
                          checkOutDate: editFormData.checkOutDate,
                          guests: editFormData.guests,
                          roomType: editFormData.roomType,
                          totalPrice: calculatedPrice,
                        });
                        setEditBooking(null);
                        setEditFormData(null);
                      } catch (error) {
                        console.error("Error updating booking:", error);
                        alert("Failed to update booking. Please try again.");
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Cancel Booking Confirmation Modal */}
        {cancelConfirmBooking && (
          <Dialog open={!!cancelConfirmBooking} onOpenChange={() => setCancelConfirmBooking(null)}>
            <DialogContent className="max-w-md" showCloseButton={false}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Cancel Booking?</h3>
                </div>
                <button
                  onClick={() => setCancelConfirmBooking(null)}
                  aria-label="Close confirmation"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Are you sure you want to cancel your booking for <strong>{cancelConfirmBooking.hotelName}</strong>?
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Check-in: {cancelConfirmBooking.checkInDate} | Check-out: {cancelConfirmBooking.checkOutDate}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </p>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setCancelConfirmBooking(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Keep Booking
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const bookingRef = doc(db, "bookings", cancelConfirmBooking.id);
                        await deleteDoc(bookingRef);
                        setCancelConfirmBooking(null);
                      } catch (error) {
                        console.error("Error cancelling booking:", error);
                        alert("Failed to cancel booking. Please try again.");
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Confirm Cancel
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* Withdraw Pending Confirmation Modal */}
        {withdrawConfirmPending && (
          <Dialog open={!!withdrawConfirmPending} onOpenChange={() => setWithdrawConfirmPending(null)}>
            <DialogContent className="max-w-md" showCloseButton={false}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Withdraw Submission?</h3>
                </div>
                <button
                  onClick={() => setWithdrawConfirmPending(null)}
                  aria-label="Close confirmation"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Are you sure you want to withdraw your pending submission for <strong>{withdrawConfirmPending?.name}</strong>?
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  This will remove the pending submission and attempt to delete any published hotel created from it.
                </p>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setWithdrawConfirmPending(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Keep Submission
                  </button>
                  <button
                    onClick={async () => {
                      await withdrawPending(withdrawConfirmPending);
                      setWithdrawConfirmPending(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Confirm Withdraw
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* Delete/Withdraw Confirmation Modal (used by top-right 'x') */}
        {deleteConfirmItem && (
          <Dialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)}>
            <DialogContent className="max-w-md" showCloseButton={false}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Delete Submission?</h3>
                </div>
                <button
                  onClick={() => setDeleteConfirmItem(null)}
                  aria-label="Close confirmation"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  x
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Are you sure you want to permanently delete <strong>{deleteConfirmItem?.name}</strong>? This action cannot be undone.
                </p>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setDeleteConfirmItem(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Keep
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const p = deleteConfirmItem;
                        if (!p) return;

                        // Always treat deletion from the user's requests list as a
                        // withdrawal of the submission. We will not delete public
                        // published hotel documents here to avoid accidental
                        // permanent removals. The server-side `ensure-delete`
                        // endpoint can decide what cleanup to perform safely.
                        await withdrawPending(p);
                      } catch (err) {
                        console.error('Delete failed', err);
                      } finally {
                        setDeleteConfirmItem(null);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
