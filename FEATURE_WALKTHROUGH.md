# Feature Walkthrough

## User Journey

### Step 1: View Hotels
```
START
  ↓
Visit http://localhost:3000/hotels
  ↓
See grid of hotels from Batangas (OSM data)
  ├─ Hotel name, image, price, availability
  ├─ Amenities tags
  └─ Action buttons: View Map, Book Now
```

### Step 2: Switch Views
```
CARD VIEW (Default)
  ↑ ↓
Toggle (📋 Cards | 🗺️ Map) in top right
  ↑ ↓
MAP VIEW (Leaflet)
  ├─ Markers for each hotel
  ├─ Click marker → popup with hotel info
  └─ Quick book from popup
```

### Step 3: View Details
```
Click Hotel Card
  ↓
Navigate to /booking/[id]
  ↓
See:
  ├─ Large hotel image
  ├─ Price, availability, status
  ├─ Amenities list
  ├─ Interactive map (exact location)
  ├─ Sidebar with booking summary
  └─ Nearby attractions section
```

### Step 4: View Recommendations
```
Nearby Recommendations Loading...
  ↓
Ollama generates:
  ├─ Restaurant 1 (with image, description, distance)
  ├─ Restaurant 2
  ├─ Entertainment 1
  ├─ Entertainment 2
  ├─ Attraction 1
  └─ Attraction 2
  
(Or uses mock data if Ollama unavailable)
```

### Step 5: Book Hotel
```
Click "Book Now"
  ↓
Not logged in?
  ├─ → Sign in first
  └─ ✓ Logged in? → Open booking modal
  
Booking Modal:
  ├─ Hotel info (name, address)
  ├─ Check-in date
  ├─ Check-out date
  ├─ Guest count (1-6)
  ├─ Room type (Standard/Deluxe/Suite)
  ├─ Price breakdown
  └─ Confirm button
  
Complete booking
  ↓
Save to Firestore
  ↓
Show success toast
  ↓
Button changes to "✓ Already Booked"
```

---

## UI Components

### Hotels Page Layout
```
┌─────────────────────────────────────────────────┐
│  Logo               Search              Navbar   │
├─────────────────────────────────────────────────┤
│  "Explore Batangas!"                            │
│  Subtitle                                        │
│                                                   │
│  Search: [_______] 📍    [📋 Cards] [🗺️ Map]   │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Hotel 1  │  │ Hotel 2  │  │ Hotel 3  │      │
│  │ ★★★★★   │  │ ★★★★☆   │  │ ★★★★★   │      │
│  │ ₱2,500   │  │ ₱3,200   │  │ ₱1,800   │      │
│  │ 5 rooms  │  │ 3 rooms  │  │ 8 rooms  │      │
│  │[Map][Go] │  │[Map][Go] │  │[Map][Go] │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Hotel 4  │  │ Hotel 5  │  │ Hotel 6  │      │
│  ...                                             │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Hotel Details Layout
```
┌─────────────────────────────────────────────────┐
│ ← Back                                           │
├─────────────────────────────────────────────────┤
│  Main Content (2/3 width)                        │
│  ┌────────────────────┐    Sidebar (1/3)       │
│  │                    │    ┌────────────────┐  │
│  │  Hotel Image       │    │ Booking Summary│  │
│  │  (Large)           │    │                │  │
│  │                    │    │ Check In:      │  │
│  └────────────────────┘    │ [Date]         │  │
│                             │ Check Out:     │  │
│  Hotel Name                 │ [Date]         │  │
│  Address                    │                │  │
│                             │ ₱2,500/night  │  │
│  ┌──────┬─────┬──────┐     │ +₱500 fees    │  │
│  │Price │Rooms│Status│     │                │  │
│  │₱2,500│  5  │Avail │     │ [Book Now]    │  │
│  └──────┴─────┴──────┘     │ (or ✓ Booked) │  │
│                             │                │  │
│  Amenities: [tag][tag]      │ ⚠️ Sign in    │  │
│                             │    to book    │  │
│  ┌────────────────────┐     └────────────────┘  │
│  │    Map             │                         │
│  │  📍 Hotel          │                         │
│  │                    │                         │
│  └────────────────────┘                         │
│                                                   │
│  Nearby Attractions & Dining                    │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Restaurant 1 │  │ Restaurant 2 │            │
│  │ [image]      │  │ [image]      │            │
│  │ "Best local" │  │ "Great food" │            │
│  │ 0.5 km away  │  │ 1.2 km away  │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Entertainment│  │ Attraction   │            │
│  │ "Karaoke"    │  │ "Volcano"    │            │
│  └──────────────┘  └──────────────┘            │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Booking Modal
```
┌─────────────────────────────────┐
│ Complete Your Booking         × │
├─────────────────────────────────┤
│ Hotel: Grand Resort             │
│ 123 Main St, Batangas           │
│                                  │
│ Check In:    [2024-01-15]       │
│ Check Out:   [2024-01-17]       │
│                                  │
│ Guests:      [3] ▼              │
│                                  │
│ Room Type:   [Deluxe] ▼         │
│                                  │
│ Pricing:                         │
│ ├─ Base 2 nights: ₱5,000       │
│ ├─ Room premium: ₱1,000        │
│ └─ TOTAL: ₱6,000               │
│                                  │
│ [Cancel]  [Confirm Booking]    │
└─────────────────────────────────┘
```

---

## Data Flow Diagram

### 1. Initial Load
```
User opens /hotels
    ↓
Overpass API query
    ↓
~120 hotels fetched with coordinates
    ↓
Render hotel cards with mock prices/availability
    ↓
Fetch address via Nominatim (optional)
    ↓
API hotel offers (optional - from API)
    ↓
Display in cards view
```

### 2. Click Hotel
```
User clicks hotel card
    ↓
Store hotel data in localStorage
    ↓
Navigate to /booking/[id]
    ↓
Load hotel from localStorage
    ↓
Ollama generates recommendations
    ↓
Unsplash fetches images for recommendations
    ↓
Render recommendations on page
```

### 3. Book Hotel
```
User clicks "Book Now"
    ↓
Check if logged in
    ↓
If not → Redirect to /signin
If yes → Open booking modal
    ↓
User fills form
    ↓
Click "Confirm Booking"
    ↓
Validate data
    ↓
Add to Firestore bookings collection
    ↓
Update booking status in UI
    ↓
Show success notification
```

---

## State Management

### Hotels Page State
```
hotels: Hotel[]                   ← All fetched hotels
filteredHotels: Hotel[]           ← After search filter
viewMode: "cards" | "map"         ← Current view
favorites: string[]               ← Favorited hotel IDs (localStorage)
userBookings: string[]            ← User's booked hotel IDs (Firestore)
selectedHotel: Hotel | null       ← For map popup
loading: boolean                  ← Loading state
```

### Hotel Details State
```
hotel: Hotel | null               ← Current hotel data
recommendations: Recommendation[] ← Nearby suggestions
isBookingOpen: boolean            ← Booking modal visibility
isBooked: boolean                 ← User already booked this
loadingHotel: boolean
loadingRecommendations: boolean
```

### Booking Modal State
```
guests: number                    ← Selected guest count
roomType: string                  ← Selected room type
isLoading: boolean                ← Submission in progress
```

---

## Key Interactions

### Search Functionality
```
User types in search box
    ↓
Debounced 300ms
    ↓
Filter hotels by:
  - Hotel name
  - Location/address
  - Amenities
  - Price (numeric search)
    ↓
Update filteredHotels state
    ↓
Re-render grid/map
```

### Favorites
```
Click heart button on card
    ↓
Update favorites state
    ↓
Save to localStorage: "favorites"
    ↓
Persist across page refreshes
```

### View Toggle
```
Current view: "cards"
User clicks 🗺️ Map
    ↓
setViewMode("map")
    ↓
Show MapContainer instead of grid
    ↓
Render all hotels as markers
```

---

## Error Handling

### Ollama Down
```
getNearbyRecommendations()
    ↓
Fetch http://localhost:11434/api/generate
    ↓
No response / Error
    ↓
Catch error
    ↓
Return mock recommendations
    ↓
User sees high-quality mock data instead
```

### Booking Failed
```
submitBooking()
    ↓
Add to Firestore
    ↓
Firestore error
    ↓
Show error toast
    ↓
Modal stays open
    ↓
User can retry
```

### Invalid Hotel
```
User navigates to /booking/999
    ↓
localStorage.selectedHotel not found
    ↓
Show "Hotel not found" message
    ↓
Offer "Go Back" button
```

---

## Responsive Design

```
Desktop (1024px+)
├─ 3-column hotel grid
├─ Sidebar booking summary
└─ Full-width recommendations

Tablet (768px-1023px)
├─ 2-column hotel grid
├─ Sidebar on small screens
└─ Stacked recommendations

Mobile (< 768px)
├─ 1-column hotel grid
├─ Full-width booking form
└─ Stacked card recommendations
```

---

**This completes the full feature walkthrough! 🎉**
