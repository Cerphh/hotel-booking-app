# HotBook — Hotel Booking App (Draft README)

HotBook is a small hotel booking demo built with Next.js (App Router). It demonstrates hotel listings, a booking flow, nearby recommendations (via Ollama / OpenAI fallback + Overpass), and simple Firebase authentication.

## Features
- Hotel list with card/map view
- Hotel details + nearby recommendations
- Booking modal and pending bookings store
- Google sign-in (Firebase Auth)
- Ollama (local) integration for recommendations, with OpenAI fallback

## Quickstart — Local development

Prerequisites:
- Node 18+ and a package manager (npm/yarn/pnpm)
- Optional: Ollama (if you want LLM-powered recommendations) — https://ollama.ai

1. Clone the repo

```bash
git clone https://github.com/Cerphh/hotel-booking-app.git
cd hotel-booking-app
```

2. Install dependencies

```bash
npm install
# or: pnpm install
```

3. Create `.env.local` (optional values shown)

```env
# Ollama (local LLM server) — defaults to http://localhost:11434
NEXT_PUBLIC_OLLAMA_API=http://localhost:11434
NEXT_PUBLIC_OLLAMA_MODEL=mistral

# (Optional) OpenAI fallback for server-side recommendation debugging
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
```

4. Start Ollama (if using it)

```bash
# in a separate terminal
ollama serve
ollama pull mistral
```

5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

## Notes
- Bookings are stored in an in-memory pending store for demo purposes (`app/api/pending`).
- Firebase config is currently embedded in `lib/firebase.ts`.

---

For deeper, developer-oriented documentation see `TECHNICAL_DOCUMENTATION.md`.