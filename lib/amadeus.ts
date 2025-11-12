// Amadeus API utility for hotel search
import axios from "axios";

const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID || "eJDVYrllfVaz1CA4WrMTzSsVbWZBMrdq";
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || "pKxZJXNGWs0ABUqo";

let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Authenticate and get a valid token
async function authenticate(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(AMADEUS_CLIENT_ID)}&client_secret=${encodeURIComponent(AMADEUS_CLIENT_SECRET)}`;

  const res = await axios.post(
    "https://test.api.amadeus.com/v1/security/oauth2/token",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const data = res.data as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // 1 min buffer
  console.log("Amadeus access token:", accessToken);
  return accessToken;
}

// Helper functions to get dates
function getCheckInDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7); // 7 days from now
  return date.toISOString().split("T")[0];
}

function getCheckOutDate() {
  const date = new Date();
  date.setDate(date.getDate() + 8); // 8 days from now
  return date.toISOString().split("T")[0];
}

// Simple city name to IATA code mapping
const CITY_CODE_MAP: Record<string, string> = {
  "new york": "NYC",
  "london": "LON",
  "paris": "PAR",
  "tokyo": "TYO",
  "los angeles": "LAX",
  "chicago": "CHI",
  "dubai": "DXB",
  "singapore": "SIN",
  "bangkok": "BKK",
  "hong kong": "HKG",
  "manila": "MNL",
  "cebu": "CEB",
  "davao": "DVO",
};

// Search hotels by city
export async function searchHotels(cityCode: string) {
  let code = cityCode.trim().toUpperCase();
  if (code.length > 3) {
    code = CITY_CODE_MAP[cityCode.trim().toLowerCase()] || code;
  }

  const token = await authenticate();

  try {
    const res = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city",
      {
        params: { cityCode: code },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = res.data as { data: any[] };
    if (!data.data || data.data.length === 0) {
      throw new Error(
        "No hotels found for this location. Try a major city or valid code (e.g., Manila, Cebu, Davao, NYC, LON, PAR)"
      );
    }

    return data.data;
  } catch (err: any) {
    console.error("Amadeus API error:", err?.response?.data || err);
    throw new Error(
      err?.response?.data?.title || err?.message || "Failed to fetch hotels."
    );
  }
}

// Search hotel offers and map to frontend-friendly format
export async function searchHotelOffers(cityCode: string) {
  let code = cityCode.trim().toUpperCase();
  if (code.length > 3) {
    code = CITY_CODE_MAP[cityCode.trim().toLowerCase()] || code;
  }

  const token = await authenticate();

  try {
    // Step 1: Get hotel IDs
    const hotelsRes = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city",
      {
        params: { cityCode: code },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const hotels = (hotelsRes.data as { data: any[] }).data;
    if (!hotels || hotels.length === 0) {
      throw new Error("No hotels found for this location.");
    }

    const hotelIds = hotels.slice(0, 10).map((h: any) => h.hotelId).join(",");

    // Step 2: Get offers for hotels
    const offersRes = await axios.get(
      "https://test.api.amadeus.com/v3/shopping/hotel-offers",
      {
        params: {
          hotelIds,
          adults: 1,
          checkInDate: getCheckInDate(),
          checkOutDate: getCheckOutDate(),
          roomQuantity: 1,
          paymentPolicy: "NONE",
          bestRateOnly: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const offersData = (offersRes.data as { data: any[] }).data;

    console.log("=== OFFERS DATA ===");
    console.log(JSON.stringify(offersData, null, 2));

    if (!offersData || offersData.length === 0) {
      throw new Error("No hotel offers available for the selected dates.");
    }

    // Map to frontend Hotel interface
    const hotelsMapped = offersData.map((h: any) => {
  const offer = h.offers?.[0] || null; // fallback if no offers

  return {
    id: h.hotel.hotelId,
    name: h.hotel.name,
    image: h.hotel.media?.[0]?.uri || "/placeholder.jpg",
    location: h.hotel.address?.cityName || "",
    description: h.hotel.description || "No description available",
    amenities: h.hotel.amenities?.map((a: any) => a.name) || [],
    availability: offer?.availableRooms || 0,
    price: offer ? parseFloat(offer.price.total) : Math.floor(Math.random() * 300) + 50, // fallback demo price
    rating: h.hotel.rating || 0,
  };
});


    return hotelsMapped;
  } catch (err: any) {
    console.error("=== API ERROR ===");
    console.error("Error data:", JSON.stringify(err?.response?.data, null, 2));
    console.error("Error status:", err?.response?.status);

    throw new Error(
      err?.response?.data?.errors?.[0]?.detail ||
        err?.response?.data?.title ||
        err?.message ||
        "Failed to fetch hotel offers."
    );
  }
}
