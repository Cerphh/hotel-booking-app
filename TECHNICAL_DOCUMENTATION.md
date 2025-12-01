# Technical Documentation — HotBook

This document provides developer-focused technical details for HotBook: architecture, data flows, key components, API routes, environment configuration, and development notes.

## Overview
HotBook is a Next.js application using the App Router. It demonstrates a minimal hotel booking UX with LLM-enhanced nearby recommendations, Google sign-in (Firebase), and a demo booking flow.

## Architecture
- Frontend: Next.js App Router using both server and client components under `app/`.
- UI: componentized in `components/` (reusable UI building blocks in `components/ui/`).
- Integrations:
  - Ollama (local LLM) via `lib/ollama.ts` for recommendations; falls back to OpenAI if configured.
  - OpenStreetMap Overpass API used to discover nearby POIs.
  - Firebase Auth initialized in `lib/firebase.ts` (Google sign-in provider).
- Data persistence: Demo uses an in-memory pending booking store at `app/api/pending` (not production-safe). For production, persist to Firestore or another database.

## File structure (high level)
- `app/` — routes, pages, and API endpoints.
  - `app/hotels` — hotels listing page.
  - `app/booking/[id]` — booking page for a selected hotel.
  - `app/api/*` — serverless API route endpoints.
- `components/` — visual components and `ui/` primitives.
- `lib/` — small utilities and third-party integrations (Firebase, Ollama, helpers).

## Key components and responsibilities
- `components/hotel-card.tsx` — individual hotel entry, actions (book, view details).
- `components/booking-modal.tsx` — booking form displayed as modal; handles form validation and booking submission to `app/api/pending`.
- `components/hotel-map.tsx` and `leaflet-map.tsx` — map views and interactions.
- `components/google-signin-button.tsx` — sign-in UI, uses `lib/firebase.ts`.
- `lib/ollama.ts` — builds POI list from Overpass, constructs a prompt, calls Ollama (or falls back to OpenAI), and normalizes the returned JSON into `NearbyRecommendation` objects.

## API routes
- `GET /api/hotels` — (fallback) returns a lightweight offer list; currently returns an empty array unless a provider is configured.
- `GET /api/pending` — returns current in-memory pending bookings.
- `POST /api/pending` — create a new pending booking (stored in memory).
- `GET /api/pending/:id` — retrieve a single pending booking.
- `DELETE /api/pending/:id` — delete a pending booking.
- `GET /api/debug-recommendations` — server-side helper that uses `lib/ollama.ts` and optionally OpenAI for generating recommendations.

Notes:
- The pending store is ephemeral and kept on `globalThis` so the API routes can share it during a single Node instance lifetime.

## Booking flow (high level)
1. User opens hotel detail page (`/booking/[id]`).
2. User clicks Book and fills the booking modal (`components/booking-modal.tsx`).
3. Booking modal posts booking data to `POST /api/pending`.
4. The pending item appears in the UI (local state is updated from the response).
5. (Optional) In production, persist booking to a database and verify payment handling.

## Recommendations flow
1. Client requests recommendations via `lib/ollama.ts` with hotel coordinates.
2. `lib/ollama.ts` runs an Overpass query to fetch nearby POIs.
3. It constructs a prompt containing candidates and calls the Ollama local server (`NEXT_PUBLIC_OLLAMA_API`).
4. Ollama returns JSON; `lib/ollama.ts` normalizes and enriches results (coordinates, distance formatting, walking time). If Ollama fails and `OPENAI_API_KEY` is available, a server-side route `debug-recommendations` can try OpenAI.
5. The UI renders the normalized `NearbyRecommendation[]` with images (Unsplash fallback) and distances.

## Environment variables
- `NEXT_PUBLIC_OLLAMA_API` — URL to Ollama server (default `http://localhost:11434`).
- `NEXT_PUBLIC_OLLAMA_MODEL` — model name used by Ollama (default `mistral`).
- `OPENAI_API_KEY` — optional server-side OpenAI key for fallback.
- `OPENAI_MODEL` — optional OpenAI model selection.

## Firebase
- Current Firebase configuration is inside `lib/firebase.ts` as a hardcoded object. It initializes Firebase Auth and provides a `googleProvider` used by sign-in components.
- Recommendation: extract Firebase configuration to environment variables (for security) before using in public repositories.

## Development & testing
- Start Ollama (optional): `ollama serve` and `ollama pull <model>`.
- Start dev server: `npm run dev`.
- Open `http://localhost:3000` and navigate to Hotels / Booking pages.
- The app has minimal automated tests; adding unit and integration tests (Jest/Playwright) is recommended before productionizing.

## Production considerations
- Replace the in-memory pending store with Firestore or a transactional backend.
- Secure API routes: add server-side authentication and input validation.
- Sanitize and validate all LLM outputs before rendering.
- Add rate-limiting and caching for Overpass queries to avoid hitting public endpoints too frequently.

## Troubleshooting
- Ollama not responding: confirm `NEXT_PUBLIC_OLLAMA_API` and that `ollama serve` is running.
- Recommendations empty: ensure Overpass returns POIs for the coordinates; check CORS and network access.
- Firebase issues: move config to env variables and verify OAuth settings in Firebase console.

## Where to look in code
- UI components: `components/` and `components/ui/`
- LLM logic: `lib/ollama.ts`
- API routes: `app/api/*`
- Booking page: `app/booking/[id]/page.tsx`

---

If you want, I can now:
- Replace the repository `README.md` with the drafted README (`README_UPDATED.md`).
- Commit both new files and open a PR branch.
- Add a short `CONTRIBUTING.md` or `ENVIRONMENT.md` for onboarding.

Tell me which of these you'd like me to do next.