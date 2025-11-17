# Quick Start Guide

## Start in 3 Steps

### Step 1: Install & Run Ollama

```powershell
# 1. Download from https://ollama.ai and install

# 2. Open PowerShell and start Ollama server
ollama serve

# 3. In another PowerShell window, pull the model
ollama pull mistral

# Verify: Visit http://localhost:11434
```

### Step 2: Run the Development Server

```powershell
npm run dev
```

The app will be available at **http://localhost:3000**

### Step 3: Test the Features

1. **View Hotels**
   - Go to the Hotels page
   - You'll see a grid of hotels from Batangas (OSM data)

2. **Toggle Views**
   - Click 📋 Cards or 🗺️ Map buttons (top right)

3. **View Hotel Details**
   - Click any hotel card
   - Scroll to see nearby recommendations from Ollama
   - Map shows exact location

4. **Book a Hotel**
   - Click "Book Now"
   - Must sign in first
   - Select room type, dates, guests
   - Complete booking (saved to Firestore)

---

## What's New

### Files Created:
- `lib/ollama.ts` - LLM integration
- `components/booking-modal.tsx` - Booking form modal

### Files Updated:
- `app/hotels/page.tsx` - Added card/map toggle
- `app/booking/[id]/page.tsx` - New details page with recommendations
- `components/hotel-card.tsx` - Enhanced styling

### Configuration:
- `.env.local` - Added Ollama settings

---

## Key Features

✅ **Hotel Search** - From OpenStreetMap  
✅ **Dual Views** - Cards or interactive map  
✅ **AI Recommendations** - Nearby attractions via Ollama  
✅ **Mock Bookings** - Full booking system with auth  
✅ **Firestore Integration** - Persistent booking storage  
✅ **Dark Mode** - Full UI support  
✅ **Responsive Design** - Works on all devices  

---

## Important Notes

⚠️ **Ollama MUST be running** at http://localhost:11434
- Without it, recommendations use mock data (still looks great!)
- Check: http://localhost:11434 in browser

⚠️ **First recommendation generation** takes 5-30 seconds
- Ollama generates on first load
- Subsequent loads are instant

⚠️ **Authentication required** to book
- Sign in with your Firebase account
- Bookings saved per user email

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Ollama not found" | Start `ollama serve` in another terminal |
| Slow recommendations | Use `ollama pull orca-mini` for faster model |
| Hotel images not loading | Unsplash API rate limit - refresh page |
| Booking won't save | Make sure you're logged in and availability > 0 |

---

## Next Steps

After verifying everything works:

1. **Customize Ollama Model**
   ```powershell
   ollama pull llama2
   # Update .env.local: NEXT_PUBLIC_OLLAMA_MODEL=llama2
   ```

2. **Add More Cities**
   - Edit `lib/osm-hotels.ts` CITY_CENTERS

3. **Enhance UI**
   - Hotel filters, sorting, ratings
   - User reviews and testimonials

4. **Production Setup**
   - Deploy with proper CORS handling
   - Use hosted LLM API
   - Add payment processing

---

**You're ready to go! 🚀**
