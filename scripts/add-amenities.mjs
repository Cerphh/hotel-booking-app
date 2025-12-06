// Run this script with: node scripts/add-amenities.mjs
// Make sure to set your Firebase config in .env.local first

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Read Firebase service account from environment
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

// Fix escaped newlines in private key
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.log('Please set it in your .env.local file');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Common amenities for different hotel types
const commonAmenities = [
  "WiFi",
  "Pool",
  "Gym",
  "Restaurant",
  "Spa",
  "Beach Access",
  "Bar",
  "Room Service",
  "Parking",
  "Air Conditioning",
  "Concierge",
  "Business Center",
  "Conference Rooms",
  "Pet Friendly",
  "24/7 Front Desk",
  "Laundry Service",
  "Airport Shuttle",
  "Hot Tub",
  "Sauna",
  "Tennis Court",
  "Garden",
  "Terrace",
  "Kids Club",
  "Babysitting",
  "Fitness Center",
];

function getRandomAmenities(min = 4, max = 8) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...commonAmenities].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function addAmenitiesToHotels() {
  try {
    const hotelsRef = db.collection('hotels');
    const snapshot = await hotelsRef.get();
    
    console.log(`Found ${snapshot.docs.length} hotels in Firestore\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const hotelDoc of snapshot.docs) {
      const data = hotelDoc.data();
      
      // Skip if amenities already exist and have values
      if (data.amenities && Array.isArray(data.amenities) && data.amenities.length > 0) {
        console.log(`⊘ Skipping "${data.name}" - already has ${data.amenities.length} amenities`);
        skipped++;
        continue;
      }
      
      // Generate random amenities
      const amenities = getRandomAmenities();
      
      // Update the hotel document
      await hotelDoc.ref.update({
        amenities: amenities,
      });
      
      console.log(`✓ Updated "${data.name}" with ${amenities.length} amenities:`);
      console.log(`  ${amenities.join(', ')}\n`);
      updated++;
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Done! Updated ${updated} hotels, skipped ${skipped} hotels.`);
    console.log(`${'='.repeat(50)}`);
  } catch (error) {
    console.error('Error adding amenities:', error);
  }
}

addAmenitiesToHotels();
