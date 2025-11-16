// lib/test-amadeus-debug.ts
import { fetchHotelOffers } from "./amadeus";

async function testAmadeus() {
  console.log("Testing Amadeus API...");
  console.log("Credentials check:");
  console.log("- AMADEUS_CLIENT_ID:", process.env.AMADEUS_CLIENT_ID ? "✓ Present" : "✗ Missing");
  console.log("- AMADEUS_CLIENT_SECRET:", process.env.AMADEUS_CLIENT_SECRET ? "✓ Present" : "✗ Missing");

  // Test coordinates for Batangas
  const testParams = {
    lat: 13.7569,
    lon: 121.0583,
    checkIn: "2025-11-20",
    checkOut: "2025-11-21",
  };

  console.log("\nTest parameters:", testParams);

  try {
    const offers = await fetchHotelOffers(testParams);
    console.log("Offers received:", JSON.stringify(offers, null, 2));
    
    if (offers.length === 0) {
      console.log("⚠️ No offers returned. Possible reasons:");
      console.log("1. Amadeus credentials are invalid");
      console.log("2. No hotels available at this location");
      console.log("3. API rate limit exceeded");
    } else {
      console.log("✓ Successfully received hotel offers");
    }
  } catch (error) {
    console.error("Error testing Amadeus:", error);
  }
}

testAmadeus();
