// lib/test-amadeus.ts
import { fetchHotelOffers } from "./amadeus"; // relative path to amadeus.ts

async function testHotelOffers() {
  try {
    // Use Batangas center coordinates as a sample
    const lat = 13.7569;
    const lon = 121.0583;
    const checkIn = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const offers = await fetchHotelOffers({ lat, lon, checkIn, checkOut: tomorrow });
    console.log("Hotel Offers (sample):", offers.slice(0, 10));

    if (offers.length > 0) {
      const first = offers[0];
      console.log(`First offer: room=${first.roomType}, price=${first.price} ${first.currency}`);
    } else {
      console.log("No offers returned from Amadeus for sample coordinates.");
    }
  } catch (err: any) {
    console.error("Failed to fetch hotel offers:", err?.message || err);
  }
}

testHotelOffers();
