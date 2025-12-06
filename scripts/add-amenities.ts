// Script to add amenities to existing hotels in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

function getRandomAmenities(min: number = 4, max: number = 8): string[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...commonAmenities].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function addAmenitiesToHotels() {
  try {
    const hotelsRef = collection(db, 'hotels');
    const snapshot = await getDocs(hotelsRef);
    
    console.log(`Found ${snapshot.docs.length} hotels in Firestore`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const hotelDoc of snapshot.docs) {
      const data = hotelDoc.data();
      
      // Skip if amenities already exist and have values
      if (data.amenities && Array.isArray(data.amenities) && data.amenities.length > 0) {
        console.log(`Skipping ${data.name} - already has amenities`);
        skipped++;
        continue;
      }
      
      // Generate random amenities
      const amenities = getRandomAmenities();
      
      // Update the hotel document
      await updateDoc(doc(db, 'hotels', hotelDoc.id), {
        amenities: amenities,
      });
      
      console.log(`✓ Updated ${data.name} with amenities:`, amenities.join(', '));
      updated++;
    }
    
    console.log(`\nDone! Updated ${updated} hotels, skipped ${skipped} hotels.`);
  } catch (error) {
    console.error('Error adding amenities:', error);
  }
}

addAmenitiesToHotels();
