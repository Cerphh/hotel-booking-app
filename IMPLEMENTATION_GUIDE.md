# Hotel Booking App - Implementation Guide

## Overview

You now have a complete hotel booking system for Batangas with the following features:

✅ **Hotels Listing** - Fetches hotels from OpenStreetMap (Overpass API)  
✅ **Dual View** - Switch between Cards and Map views  
✅ **Hotel Details** - Detailed page with location map and nearby attractions  
✅ **LLM Integration** - Uses Ollama for AI-powered recommendations  
✅ **Mock Booking** - Complete booking system (requires authentication)  
✅ **Dark Mode** - Full dark mode support throughout

---

## Prerequisites

### 1. Install Ollama (Required for LLM features)

**What is Ollama?**  
Ollama is a free, local LLM engine that runs on your machine. Perfect for offline AI features.

**Installation:**

1. Download from: https://ollama.ai
2. Install for your OS (Windows, Mac, or Linux)
3. Open terminal/PowerShell and run:
   ```powershell
   ollama serve
   ```
4. In another terminal, pull a model:
   ```powershell
   ollama pull mistral
   ```

**Verify Installation:**
- Visit http://localhost:11434 in your browser
- You should see Ollama running

### 2. Existing Setup

- Firebase authentication (already configured)
- Leaflet maps (already installed)
- Framer Motion animations (already installed)

---

## Architecture

### 1. Hotel Data Flow

```
Overpass API (OSM)
    ↓
lib/osm-hotels.ts → Fetches tourism=hotel in Batangas
    ↓
app/hotels/page.tsx → Displays in cards or map view
    ↓
lib/ollama.ts → Generates recommendations
    ↓
app/booking/[id]/page.tsx → Shows details + nearby attractions
```

### 2. File Structure

```
lib/
├── ollama.ts                 ← NEW: Ollama LLM integration
├── auth-context.tsx          ← Authentication
├── osm-hotels.ts            ← OSM data fetching
└── ...

components/
├── booking-modal.tsx         ← NEW: Booking modal
└── hotel-card.tsx           ← UPDATED: Enhanced card component

app/
├── hotels/page.tsx          ← UPDATED: Added card/map toggle
└── booking/[id]/page.tsx    ← UPDATED: New details + recommendations
```

---

## Features Explained

### 1. Card vs Map View (Hotels Page)

- **Cards View**: Grid display of all hotels with quick book button
- **Map View**: Interactive map showing all hotels as markers
- Toggle buttons in the top right (📋 Cards | 🗺️ Map)

### 2. Hotel Details Page

When you click a hotel card or marker, you navigate to `/booking/[id]` which shows:

- **Hotel Image** - Large cover photo
- **Key Info** - Price per night, availability, booking status
- **Amenities** - List of available facilities
- **Interactive Map** - Location and specific coordinates
- **Nearby Attractions** - AI-powered recommendations
  - 2 Restaurants
  - 2 Entertainment venues
  - 2 Tourist attractions
  - Each with: name, description, distance, and images from Unsplash

### 3. Booking System

1. User clicks "Book Now" → Must be logged in
2. Opens booking modal with:
   - Check-in/Check-out dates
   - Guest count selector
   - Room type selection (Standard, Deluxe, Suite)
   - Price breakdown
3. Submit booking → Saves to Firestore
4. Booking status saved per user email

### 4. Ollama Integration

**How it works:**

```
getNearbyRecommendations(latitude, longitude, hotelName)
    ↓
Sends prompt to Ollama API at http://localhost:11434
    ↓
Ollama generates 6 recommendations
    ↓
If Ollama unavailable → Falls back to mock data
    ↓
Fetches images from Unsplash API
    ↓
Returns formatted recommendations
```

**Fallback Behavior:**
If Ollama is not running, the app automatically uses high-quality mock data (Batangas-specific recommendations).

---

## Getting Started

### Step 1: Start Ollama

```powershell
ollama serve
```

### Step 2: Run the App

```powershell
npm run dev
```

### Step 3: Access the App

- Open http://localhost:3000
- Navigate to Hotels page
- Toggle between card/map views
- Click a hotel to see details and recommendations

---

## Configuration

### Ollama Settings (.env.local)

```
NEXT_PUBLIC_OLLAMA_API=http://localhost:11434
NEXT_PUBLIC_OLLAMA_MODEL=mistral
```

**Changing Models:**

To use a different LLM model:

```powershell
ollama pull llama2         # or any other model
ollama pull neural-chat
ollama pull orca-mini
```

Then update `.env.local`:
```
NEXT_PUBLIC_OLLAMA_MODEL=llama2
```

---

## API Endpoints

### 1. Overpass API (OSM)
- **URL**: https://lz4.overpass-api.de/api/interpreter
- **Query**: tourism=hotel in Batangas admin boundary
- **Returns**: ~120 hotels with coordinates

### 2. Ollama API
- **URL**: http://localhost:11434/api/generate
- **Method**: POST
- **Payload**: Prompt for nearby recommendations
- **Model**: Mistral (or configured model)

### 3. Nominatim API (Address Lookup)
- **URL**: https://nominatim.openstreetmap.org/reverse
- **Purpose**: Convert coordinates to addresses

### 4. Unsplash API
- **URL**: https://source.unsplash.com/400x300/?query
- **Purpose**: Get random relevant images

---

## Booking Data Storage

All bookings are stored in Firestore with this structure:

```javascript
{
  hotelId: string,
  hotelName: string,
  userEmail: string,
  userId: string,
  userName: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  roomType: string,
  totalPrice: number,
  status: "confirmed",
  bookingDate: ISO8601,
  hotelCoordinates: {
    latitude: number,
    longitude: number
  }
}
```

---

## Testing Checklist

- [ ] Ollama running at http://localhost:11434
- [ ] Toggle between card and map views
- [ ] Click a hotel card → Goes to details page
- [ ] See nearby recommendations loading
- [ ] Click "Book Now" without login → Redirects to sign in
- [ ] Sign in → Can complete booking
- [ ] Booking saved to Firestore
- [ ] Hotel shows "✓ Already Booked" after booking
- [ ] Dark mode toggle works throughout
- [ ] Favorites feature works (heart button)

---

## Troubleshooting

### "Ollama service unavailable"
- **Fix**: Start Ollama with `ollama serve`
- **Fallback**: App uses mock data automatically

### Recommendations take too long
- **Reason**: First generation with Ollama can be slow (~5-30 seconds)
- **Fix**: Decrease temperature or use faster model like `orca-mini`

### Hotel images not loading
- **Fix**: Unsplash API might be rate-limited
- **Fallback**: Uses Unsplash placeholder images

### Booking not saving
- **Check**: 
  - User is logged in
  - Availability > 0
  - No duplicate bookings for same user/hotel

---

## Performance Tips

1. **Optimize Ollama**: Use lightweight models like `orca-mini` for faster responses
2. **Cache Results**: Recommendations are fetched once per hotel load
3. **Lazy Load**: Images use native lazy loading
4. **Map Virtualization**: Map only renders visible markers

---

## Future Enhancements

- [ ] Real booking payment integration
- [ ] Email confirmation sent
- [ ] User reviews and ratings
- [ ] Advanced filters (price range, amenities)
- [ ] Calendar availability view
- [ ] Multi-language support
- [ ] SMS notifications
- [ ] Weather API integration

---

## Support

For issues or questions:
1. Check Ollama is running: http://localhost:11434
2. Check browser console for errors
3. Verify Firestore rules allow read/write
4. Check environment variables in `.env.local`

---

**Happy Booking! 🎉**
