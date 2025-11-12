// lib/test-amadeus.ts
import { searchHotelOffers } from "./amadeus"; // relative path to amadeus.ts

async function testHotelOffers() {
  try {
    // Replace "Manila" with any city you want to test
    const offers = await searchHotelOffers("Manila");
    console.log("Hotel Offers:", offers);

    // Example: log first hotel name and price
    if (offers.length > 0) {
      const first = offers[0];
      console.log(`First hotel: ${first.name}, Price: $${first.price}`);
    }
  } catch (err: any) {
    console.error("Failed to fetch hotel offers:", err.message);
  }
}

testHotelOffers();
