"use client";

import { useEffect, useMemo, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  Calendar,
  CreditCard,
  MapPin,
  PlaneTakeoff,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { 
  getAuth,
} from "firebase/auth";
import app from "@/lib/firebase";

const profileSchema = z.object({
  fullName: z.string().min(2, "Add your full name"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => {
        if (!value) return true;
        return (value?.replace(/[^\d]/g, "") ?? "").length >= 7;
      },
      "Enter a valid phone"
    ),
  country: z.string().min(1, "Select a country"),
  city: z.string().optional().or(z.literal("")),
  preferredAirport: z.string().optional().or(z.literal("")),
  travelStyle: z.string().min(1, "Choose a travel style"),
  seatingPreference: z.string().min(1, "Pick a seat preference"),
  mealPreference: z.string().min(1, "Pick a meal preference"),
  dietaryNotes: z.string().optional().or(z.literal("")),
  bio: z.string().max(320, "Keep it under 320 characters").optional().or(z.literal("")),
  loyaltyEmails: z.boolean(),
  smsAlerts: z.boolean(),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => {
        if (!value) return true;
        return (value?.replace(/[^\d]/g, "") ?? "").length >= 6;
      },
      "Enter a valid contact number"
    ),
  passportNumber: z.string().optional().or(z.literal("")),
  passportExpiry: z.string().optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  currency: z.string().min(1, "Select a currency"),
  timezone: z.string().min(1, "Select a timezone"),
});

type ProfileFormValues = z.output<typeof profileSchema>;

type BookingSummary = {
  id: string;
  hotelName: string;
  hotelLocation?: string;
  checkInDate?: string;
  checkOutDate?: string;
  createdAt?: Timestamp;
};

type FavoriteHotel = {
  id: string;
  name: string;
  location: string;
  image?: string;
  price?: number;
};

const defaultProfile: ProfileFormValues = {
  fullName: "",
  phone: "",
  country: "Philippines",
  city: "",
  preferredAirport: "",
  travelStyle: "Leisure & boutique",
  seatingPreference: "Aisle",
  mealPreference: "Standard",
  dietaryNotes: "",
  bio: "",
  loyaltyEmails: true,
  smsAlerts: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  passportNumber: "",
  passportExpiry: "",
  dob: "",
  currency: "PHP",
  timezone: "GMT+08:00",
};

const loyaltyTiers = [
  {
    min: 0,
    label: "Explorer",
    highlight: "Personalized picks unlocked",
    perks: ["Mobile-only prices", "Priority chat support"],
    accent: "from-[#8FABD4] to-[#4A70A9]",
  },
  {
    min: 3,
    label: "Voyager",
    highlight: "Late checkout privileges",
    perks: ["Room upgrades when available", "Dedicated travel curator"],
    accent: "from-[#4A70A9] to-[#1B3054]",
  },
  {
    min: 8,
    label: "Jetsetter",
    highlight: "Suite upgrades guaranteed",
    perks: ["48h price locks", "On-property welcome treats"],
    accent: "from-[#0F172A] to-[#4A70A9]",
  },
];

const travelStyles = [
  "Leisure & boutique",
  "Business & efficiency",
  "Family-friendly",
  "Adventure & outdoors",
  "Wellness escapes",
];

const seatingOptions = ["Aisle", "Window", "Bulkhead", "Exit row"];

const mealOptions = ["Standard", "Vegetarian", "Vegan", "Gluten-free", "Low sodium", "Kosher"];

const currencyOptions = ["PHP", "USD", "EUR", "JPY", "SGD", "AUD"];

const timezoneOptions = [
  "GMT-08:00",
  "GMT-05:00",
  "GMT",
  "GMT+01:00",
  "GMT+05:30",
  "GMT+08:00",
  "GMT+10:00",
];

const checklistFields: (keyof ProfileFormValues)[] = [
  "fullName",
  "phone",
  "country",
  "preferredAirport",
  "travelStyle",
  "seatingPreference",
  "mealPreference",
  "passportNumber",
  "passportExpiry",
  "emergencyContactName",
  "emergencyContactPhone",
];

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileFormValues>(defaultProfile);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [favorites, setFavorites] = useState<FavoriteHotel[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [verificationId, setVerificationId] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaultProfile,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("hotbook:profile");
    const parsed = stored ? (JSON.parse(stored) as Partial<ProfileFormValues>) : {};
    const seeded: ProfileFormValues = {
      ...defaultProfile,
      ...(user?.displayName ? { fullName: user.displayName } : {}),
      ...(user?.phoneNumber ? { phone: user.phoneNumber } : {}),
      ...parsed,
    };
    setProfileData(seeded);
    form.reset(seeded);
  }, [form, user?.displayName, user?.phoneNumber]);

  useEffect(() => {
    if (!user?.uid) {
      setBookings([]);
      return;
    }
    const db = getFirestore(app);
    const bookingsQuery = query(
      collection(db, "bookings"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            hotelName:
              data.hotelName || data.hotel?.name || data.hotel?.hotelName || data.name || "Unknown hotel",
            hotelLocation:
              data.hotelLocation || data.hotel?.location || data.hotel?.address || data.address || "",
            checkInDate: data.checkIn || data.checkInDate || data.checkInDateISO || "",
            checkOutDate: data.checkOut || data.checkOutDate || data.checkOutDateISO || "",
            createdAt: data.createdAt,
          } as BookingSummary;
        });
        setBookings(mapped);
      },
      (error) => {
        console.error("Failed to fetch bookings", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedRaw = JSON.parse(localStorage.getItem("savedHotels") ?? "[]");
      const normalized: FavoriteHotel[] = savedRaw.map((hotel: any, idx: number) => ({
        id: hotel.id || hotel.hotelId || `favorite-${idx}`,
        name: hotel.name || hotel.hotelName || hotel.title || "Saved stay",
        location: hotel.location || hotel.hotelLocation || hotel.address || "Batangas, Philippines",
        image: hotel.image || hotel.imageUrl || hotel.hotelImage,
        price: hotel.price || hotel.totalPrice,
      }));
      setFavorites(normalized);
    } catch (error) {
      console.error("Failed to parse favorite hotels", error);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestore(app);
    const userDocRef = doc(db, "users", user.uid);
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        setIs2FAEnabled(docSnap.data()?.mfaEnabled || false);
      }
    });
  }, [user?.uid]);

  const profileCompletion = useMemo(() => {
    const filled = checklistFields.filter((field) => {
      const value = profileData[field];
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return Boolean(value);
    }).length;
    return Math.round((filled / checklistFields.length) * 100);
  }, [profileData]);

  const loyaltyTier = useMemo(() => {
    return loyaltyTiers.reduce((acc, tier) => (bookings.length >= tier.min ? tier : acc), loyaltyTiers[0]);
  }, [bookings.length]);

  const upcomingTrip = useMemo(() => {
    const now = new Date();
    const upcoming = bookings
      .map((booking) => ({
        ...booking,
        date: booking.checkInDate ? new Date(booking.checkInDate) : null,
      }))
      .filter((booking) => booking.date && !Number.isNaN(booking.date.getTime()) && booking.date >= now)
      .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));
    return upcoming[0] ?? null;
  }, [bookings]);

  const passportStatus = useMemo(() => {
    if (!profileData.passportExpiry) {
      return { label: "Add expiry date", tone: "text-amber-600" };
    }
    const expiry = new Date(profileData.passportExpiry);
    if (Number.isNaN(expiry.getTime())) {
      return { label: "Check expiry format", tone: "text-amber-600" };
    }
    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return { label: "Passport expired", tone: "text-red-600" };
    }
    if (diffDays < 180) {
      return { label: `Expires in ${diffDays} days`, tone: "text-amber-600" };
    }
    return { label: `Valid until ${expiry.toLocaleDateString()}`, tone: "text-emerald-600" };
  }, [profileData.passportExpiry]);

  const personaBadges = useMemo(() => {
    const badges = [profileData.travelStyle, profileData.mealPreference];
    if (bookings.length >= 5) badges.push("Frequent weekender");
    if (favorites.length >= 3) badges.push("Curates hotel lists");
    if (profileData.seatingPreference) badges.push(`${profileData.seatingPreference} seat fan`);
    return badges.filter(Boolean);
  }, [bookings.length, favorites.length, profileData.mealPreference, profileData.seatingPreference, profileData.travelStyle]);

  const onSubmit = (values: ProfileFormValues) => {
    setProfileData(values);
    if (typeof window !== "undefined") {
      localStorage.setItem("hotbook:profile", JSON.stringify(values));
    }
    toast.success("Profile updated successfully!");
  };

  const handleShareItinerary = () => {
    if (!upcomingTrip) {
      toast.error("No upcoming trip to share!");
      return;
    }
    const shareText = `My upcoming trip: ${upcomingTrip.hotelName} on ${new Date(upcomingTrip.checkInDate || "").toLocaleDateString()}`;
    if (navigator.share) {
      navigator.share({ title: "My Trip", text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Trip details copied to clipboard!");
    }
  };

  const handleCompleteProfile = () => {
    setActiveTab("profile");
    setTimeout(() => {
      const firstEmptyField = document.querySelector('input[value=""]') as HTMLInputElement;
      firstEmptyField?.focus();
    }, 100);
  };

  const handlePlanEscape = () => {
    router.push("/hotels");
  };

  const handleMakeDefault = () => {
    toast.success("Payment method set as default!");
  };

  const handleAddPayment = () => {
    toast.info("Add payment method feature coming soon!");
  };

  const handleEditAlerts = () => {
    setActiveTab("profile");
  };

  const handleEnable2FA = () => {
    if (is2FAEnabled) {
      if (confirm("Disable 2FA? This will make your account less secure.")) {
        handleDisable2FA();
      }
      return;
    }
    setShow2FADialog(true);
  };

  const handleSendVerificationCode = async () => {
    setIsEnabling2FA(true);
    try {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store code temporarily (in production, this should be server-side)
      sessionStorage.setItem("temp2FACode", code);
      sessionStorage.setItem("temp2FAExpiry", (Date.now() + 5 * 60 * 1000).toString()); // 5 min expiry
      
      // Simulate sending email (in production, use a backend service)
      console.log("2FA Code:", code); // For development
      
      setVerificationId("email-verification");
      toast.success("Verification code sent to " + user?.email);
      toast.info("Dev Mode: Check console for code");
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsEnabling2FA(true);
    try {
      const storedCode = sessionStorage.getItem("temp2FACode");
      const expiry = sessionStorage.getItem("temp2FAExpiry");
      
      if (!storedCode || !expiry || Date.now() > parseInt(expiry)) {
        toast.error("Verification code expired. Please request a new one.");
        setVerificationId("");
        setVerificationCode("");
        sessionStorage.removeItem("temp2FACode");
        sessionStorage.removeItem("temp2FAExpiry");
        setIsEnabling2FA(false);
        return;
      }

      if (verificationCode !== storedCode) {
        toast.error("Invalid verification code");
        setIsEnabling2FA(false);
        return;
      }

      const auth = getAuth(app);
      if (!auth.currentUser) {
        toast.error("Please sign in first");
        return;
      }

      // Save 2FA status to Firestore
      const db = getFirestore(app);
      const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        mfaEnabled: true,
        mfaMethod: "email",
        mfaEmail: user?.email,
        mfaSecret: secret, // In production, encrypt this
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      sessionStorage.removeItem("temp2FACode");
      sessionStorage.removeItem("temp2FAExpiry");

      setIs2FAEnabled(true);
      setShow2FADialog(false);
      setVerificationCode("");
      setVerificationId("");
      toast.success("2FA enabled successfully!");
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast.error(error.message || "Invalid verification code");
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      const auth = getAuth(app);
      if (!auth.currentUser) return;

      // Update Firestore
      const db = getFirestore(app);
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        mfaEnabled: false,
        mfaMethod: null,
        mfaSecret: null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setIs2FAEnabled(false);
      toast.success("2FA disabled");
    } catch (error: any) {
      console.error("Error disabling 2FA:", error);
      toast.error(error.message || "Failed to disable 2FA");
    }
  };

  const handleSignOutDevices = () => {
    if (confirm("Sign out of all other devices?")) {
      toast.success("Signed out of other devices!");
    }
  };

  const handleExportTrips = () => {
    if (bookings.length === 0) {
      toast.error("No trips to export yet!");
      return;
    }
    
    const csv = [
      ["Hotel", "Location", "Check-in", "Check-out", "Booking Date"].join(","),
      ...bookings.map(b => [
        b.hotelName,
        b.hotelLocation,
        b.checkInDate,
        b.checkOutDate,
        new Date(b.createdAt?.toDate?.() || Date.now()).toLocaleDateString()
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotbook-trips-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Trip history exported successfully!");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFECE3] dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    redirect("/signin");
  }

  const travelerSince = profileData.dob ? new Date(profileData.dob).getFullYear() : 2019;

  return (
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950 pb-12 pt-8">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 gap-2 rounded-full bg-white/70 p-1 shadow-sm backdrop-blur dark:bg-zinc-900/60">
            <TabsTrigger value="overview" className="rounded-full text-sm font-semibold data-[state=active]:bg-[#4A70A9] data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-full text-sm font-semibold data-[state=active]:bg-[#4A70A9] data-[state=active]:text-white">
              Traveler profile
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-full text-sm font-semibold data-[state=active]:bg-[#4A70A9] data-[state=active]:text-white">
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="border-none bg-white/90 shadow-lg backdrop-blur dark:bg-zinc-900/80">
              <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-[#8FABD4]/60">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "Traveler"} />
                    <AvatarFallback className="bg-[#8FABD4]/30 text-[#1B3054]">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] dark:text-white">
                        {profileData.fullName || user.displayName || "Traveler"}
                      </h1>
                      <Badge className={`bg-linear-to-r ${loyaltyTier.accent} text-white border-0`}>{loyaltyTier.label}</Badge>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Traveler since {travelerSince}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="border-[#8FABD4]/50 text-[#1B3054] dark:text-white" onClick={handleShareItinerary}>
                    Share itinerary
                  </Button>
                  <Button className="bg-[#4A70A9] text-white hover:bg-[#4A70A9]/90" onClick={handleCompleteProfile}>
                    Complete profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-[#8FABD4]/40 bg-white/90 dark:bg-zinc-900/80">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-sm text-zinc-500">Profile completeness</CardTitle>
                  <div className="text-3xl font-semibold text-[#0F172A] dark:text-white">{profileCompletion}%</div>
                  <CardDescription className="text-xs text-zinc-500">
                    Add passport and emergency contact to unlock express checkout like on Booking.com and Expedia.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-2 w-full rounded-full bg-[#8FABD4]/30">
                    <div
                      className="h-full rounded-full bg-[#4A70A9] transition-all"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#8FABD4]/40 bg-white/90 dark:bg-zinc-900/80">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm text-zinc-500">Trips this year</CardTitle>
                  <div className="text-3xl font-semibold text-[#0F172A] dark:text-white">{bookings.length}</div>
                  <CardDescription className="text-xs text-zinc-500">Mirrors the stay counter you see on Airbnb & Hotels.com dashboards.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl bg-[#8FABD4]/15 p-3 text-xs text-[#1B3054] dark:text-zinc-200">
                    {bookings[0]?.hotelName ? `Last stayed at ${bookings[0].hotelName}` : "No trips logged yet"}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#8FABD4]/40 bg-white/90 dark:bg-zinc-900/80">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-sm text-zinc-500">
                    <PlaneTakeoff className="h-4 w-4 text-[#4A70A9]" />
                    Next stay
                  </CardTitle>
                  {upcomingTrip ? (
                    <>
                      <div className="text-lg font-semibold text-[#0F172A] dark:text-white">
                        {upcomingTrip.hotelName}
                      </div>
                      <CardDescription className="text-xs text-zinc-500">
                        {upcomingTrip.checkInDate &&
                          new Date(upcomingTrip.checkInDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        {upcomingTrip.hotelLocation ? ` · ${upcomingTrip.hotelLocation}` : ""}
                      </CardDescription>
                    </>
                  ) : (
                    <CardDescription className="text-xs text-zinc-500">No trips booked. Save a stay to fast-track checkout.</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="text-[#4A70A9]" onClick={handlePlanEscape}>
                    Plan a weekend escape
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-[#4A70A9]" />
                    Travel persona
                  </CardTitle>
                  <CardDescription>Surfacing tags similar to Expedia profile chips to help recommend the right stays.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {personaBadges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="border-[#8FABD4]/50 bg-[#EFECE3] text-[#1B3054]">
                      {badge}
                    </Badge>
                  ))}
                  {!personaBadges.length && (
                    <p className="text-sm text-zinc-500">Tell us how you like to travel to unlock smarter picks.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="text-base">Passport & safety</CardTitle>
                  <CardDescription>Inspired by Booking.com's traveler documents hub.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Passport</p>
                    <p className={`font-medium ${passportStatus.tone}`}>
                      {profileData.passportNumber ? `• ${profileData.passportNumber}` : "Add passport number"}
                    </p>
                    <p className={`text-xs ${passportStatus.tone}`}>{passportStatus.label}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Emergency contact</p>
                    <p className="font-medium text-[#0F172A] dark:text-white">
                      {profileData.emergencyContactName || "Missing contact"}
                    </p>
                    <p className="text-xs text-zinc-500">{profileData.emergencyContactPhone || "Add phone number"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-[#4A70A9]" />
                    Payment methods
                  </CardTitle>
                  <CardDescription>Keep a default card like Booking.com and Agoda for one-tap checkouts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-[#8FABD4]/40 bg-[#8FABD4]/10 p-3">
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">Visa •••• 2914</p>
                      <p className="text-xs text-zinc-500">Primary • Expires 04/28</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleMakeDefault}>
                      Make default
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[#8FABD4]/20 p-3">
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">GCash Wallet</p>
                      <p className="text-xs text-zinc-500">Verified · Instant refunds</p>
                    </div>
                    <Badge variant="secondary">Preferred</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-[#4A70A9]" onClick={handleAddPayment}>
                    + Add another payment method
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="h-4 w-4 text-[#4A70A9]" />
                    Communication preferences
                  </CardTitle>
                  <CardDescription>Similar to Airbnb's alerts settings so you decide what gets pinged.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-[#8FABD4]/30 p-3">
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">Deal alerts</p>
                      <p className="text-xs text-zinc-500">Curated Batangas flash sales</p>
                    </div>
                    <Badge variant={profileData.loyaltyEmails ? "default" : "secondary"}>
                      {profileData.loyaltyEmails ? "On" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[#8FABD4]/30 p-3">
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">Travel day SMS</p>
                      <p className="text-xs text-zinc-500">Gate changes & weather nudges</p>
                    </div>
                    <Badge variant={profileData.smsAlerts ? "default" : "secondary"}>
                      {profileData.smsAlerts ? "On" : "Off"}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#4A70A9]" onClick={handleEditAlerts}>
                    Edit alerts
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-[#4A70A9]" />
                  Saved stays
                </CardTitle>
                <CardDescription>Just like the "Trips" shelf on Airbnb — the top hotels you keep returning to.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {favorites.length ? (
                  favorites.slice(0, 4).map((hotel) => (
                    <div 
                      key={hotel.id} 
                      className="flex gap-3 rounded-2xl border border-[#8FABD4]/30 p-3 cursor-pointer hover:bg-[#8FABD4]/10 transition-colors"
                      onClick={() => router.push(`/booking/${hotel.id}`)}
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#8FABD4]/20">
                        <img
                          src={hotel.image || "https://via.placeholder.com/160x160?text=Stay"}
                          alt={hotel.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A] dark:text-white">{hotel.name}</p>
                        <p className="text-xs text-zinc-500">{hotel.location}</p>
                        {hotel.price && (
                          <p className="text-xs font-semibold text-[#4A70A9]">From ₱{hotel.price.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">Save a hotel to surface it here for one-tap rebooking.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card className="border-none bg-white/95 shadow-lg dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle>Traveler details</CardTitle>
                <CardDescription>Inspired by Booking.com and Agoda traveler profiles. Completing these unlocks quicker checkouts.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input placeholder="As shown on passport" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. +63 917 123 4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Home country</FormLabel>
                            <FormControl>
                              <Input placeholder="Where your trips start" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="City" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="preferredAirport"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred airport</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. MNL" {...field} />
                            </FormControl>
                            <FormDescription>Used to prefill search similar to Expedia.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="travelStyle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Travel style</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {travelStyles.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="seatingPreference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seat preference</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seat" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {seatingOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="mealPreference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meal preference</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Meal" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mealOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dietaryNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dietary notes</FormLabel>
                            <FormControl>
                              <Input placeholder="Allergies, restrictions" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trip summary</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Tell us how you pick stays, similar to Airbnb profile intros" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="passportNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport number</FormLabel>
                            <FormControl>
                              <Input placeholder="Optional" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="passportExpiry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport expiry</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dob"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency contact name</FormLabel>
                            <FormControl>
                              <Input placeholder="Required for express booking" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency contact phone</FormLabel>
                            <FormControl>
                              <Input placeholder="Phone" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {currencyOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {timezoneOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3">
                      <FormField
                        control={form.control}
                        name="loyaltyEmails"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 rounded-2xl border border-[#8FABD4]/40 bg-[#8FABD4]/10 p-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 text-sm">
                              <FormLabel className="text-base">Exclusive offers</FormLabel>
                              <FormDescription>Works like Booking.com Genius emails — flash deals only when it matters.</FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="smsAlerts"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 rounded-2xl border border-[#8FABD4]/40 p-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 text-sm">
                              <FormLabel className="text-base">Trip-day SMS</FormLabel>
                              <FormDescription>Get alerts for gate changes & weather like Expedia Traveler Alerts.</FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={() => form.reset(profileData)}>
                        Reset changes
                      </Button>
                      <Button type="submit" className="bg-[#4A70A9] text-white hover:bg-[#4A70A9]/90">
                        Save traveler profile
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4 text-[#4A70A9]" />
                    Two-factor authentication
                  </CardTitle>
                  <CardDescription>Borrowed from Expedia's account security screen — keep your trips safe.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-[#8FABD4]/30 p-3">
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">
                        {is2FAEnabled ? "2FA Active" : "2FA Not Enabled"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {is2FAEnabled 
                          ? `Protected with email verification (${user?.email})`
                          : "Secure your account with two-factor authentication"
                        }
                      </p>
                    </div>
                    <Badge variant={is2FAEnabled ? "default" : "secondary"}>
                      {is2FAEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <Button 
                    size="sm" 
                    variant={is2FAEnabled ? "destructive" : "outline"} 
                    onClick={handleEnable2FA}
                  >
                    {is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRoundCheck className="h-4 w-4 text-[#4A70A9]" />
                    Verified devices
                  </CardTitle>
                  <CardDescription>See where you are signed in; mirrors Airbnb's device list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-2xl border border-[#8FABD4]/30 p-3">
                    <p className="font-semibold text-[#0F172A] dark:text-white">iPhone 15 Pro</p>
                    <p className="text-xs text-zinc-500">Last active · 2 hours ago • Manila</p>
                  </div>
                  <div className="rounded-2xl border border-[#8FABD4]/30 p-3">
                    <p className="font-semibold text-[#0F172A] dark:text-white">MacBook Air</p>
                    <p className="text-xs text-zinc-500">Last active · Yesterday • Makati</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-[#4A70A9]" onClick={handleSignOutDevices}>
                    Sign out of other devices
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#8FABD4]/40 bg-white/95 dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-[#4A70A9]" />
                  Trip record export
                </CardTitle>
                <CardDescription>Download a CSV of every stay like the statements area on Booking.com Business.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3 text-sm">
                <p className="text-zinc-600 dark:text-zinc-300">Need receipts for reimbursement? Export your HotBook history anytime.</p>
                <Button size="sm" className="bg-[#4A70A9] text-white hover:bg-[#4A70A9]/90" onClick={handleExportTrips}>
                  Export trips
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 2FA Setup Dialog */}
        <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Add an extra layer of security to your account. We'll send a verification code to {user?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!verificationId ? (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Click the button below to receive a 6-digit verification code at:
                    </p>
                    <p className="text-sm font-semibold">{user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSendVerificationCode} 
                      disabled={isEnabling2FA}
                      className="flex-1"
                    >
                      {isEnabling2FA ? "Sending..." : "Send Verification Code"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShow2FADialog(false)}
                      disabled={isEnabling2FA}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Verification Code</label>
                    <Input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      disabled={isEnabling2FA}
                      className="text-center text-lg tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code sent to {user?.email}
                    </p>
                    <p className="text-xs text-amber-600">
                      Dev Mode: Check browser console for the code
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleVerify2FA} 
                      disabled={isEnabling2FA || verificationCode.length !== 6}
                      className="flex-1"
                    >
                      {isEnabling2FA ? "Verifying..." : "Verify & Enable"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setVerificationId("");
                        setVerificationCode("");
                      }}
                      disabled={isEnabling2FA}
                    >
                      Back
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
