# HotBook — Project Documentation

This document provides developer-oriented documentation for HotBook (hotel-booking-app): architecture, setup, styling notes, and contribution guidance.

## Overview

HotBook is a demo hotel booking application built with Next.js (App Router). It showcases hotel listings, a booking flow, nearby recommendations (via Ollama / OpenAI fallback + Overpass), and Firebase authentication for Google sign-in.

## Features

- Hotel list with card and map views
- Hotel details including nearby recommendations
- Booking modal with a pending-bookings in-memory store (`app/api/pending`)
- Google Sign-In via Firebase
- Ollama local LLM integration with OpenAI fallback

## Local Setup

Prerequisites:
- Node 18+ and a package manager (npm/pnpm/yarn)
- Optional: Ollama (https://ollama.ai) for local LLM recommendations

Steps:

1. Install dependencies

```bash
npm install
# or: pnpm install
```

2. Create `.env.local` (example values)

```env
# Ollama (local LLM server) — defaults to http://localhost:11434
NEXT_PUBLIC_OLLAMA_API=http://localhost:11434
NEXT_PUBLIC_OLLAMA_MODEL=mistral

# Optional OpenAI fallback
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
```

3. (Optional) Start Ollama in a separate terminal:

```bash
# ollama serve
# ollama pull mistral
```

4. Run dev server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Architecture & Important Files

- `app/` — Next.js App Router pages and API routes
  - `app/api/*` — demo APIs (pending bookings, recommendations, hotels)
- `components/` — React components used across the app (cards, forms, map wrappers)
- `lib/` — utilities and providers (Firebase, auth context, recommended integrations)
- `app/globals.css` — global Tailwind + project CSS (custom styles appended here)

## Styling Notes

The project uses Tailwind CSS with custom CSS variables. Global styles live in `app/globals.css` and include a small set of custom classes for layout and components:

- `.container` — central page container
- `.site-nav` — basic navbar layout
- `.hotel-grid` — responsive hotel grid
- `.hotel-card` — card layout for hotels
- `.btn`, `.btn-primary`, `.btn-outline` — button utilities
- `.form-input` — form field styling

If you add components, prefer Tailwind utilities first; place any shared CSS in `app/globals.css` and keep classes generic.

## Running & Debugging Recommendations

- Use the browser devtools to inspect the Leaflet map—styles are imported at the top of `globals.css`.
- The pending bookings store is in-memory and ephemeral; use `app/api/pending` to view and manipulate records for testing.

## Contribution Guide

1. Create an issue describing your change.
2. Open a branch `feature/<short-desc>` from `main`.
3. Keep changes small and focused.
4. Update documentation as needed (this file or `README.md`).

## Where to improve next

- Persist pending bookings to a lightweight DB (SQLite or Firestore) for a more realistic demo
- Add unit / integration tests for API routes
- Expand LLM recommendation tests (mock Ollama/OpenAI responses)

---
Generated: developer documentation for quick onboarding and styling notes.

## Research: Intelligent & Flexible Booking Features

### HotBook: An Intelligent and Flexible Hotel Booking Platform

#### Overview
This project presents an innovative Hotel Booking Web Application that enhances the traditional booking experience through artificial intelligence and dynamic pricing technology. The system integrates an AI Trip Curator that personalizes travel recommendations based on user interests, and a FlexiStay Optimization feature that allows flexible stay durations with real-time price adjustments. By combining convenience, personalization, and flexibility, this platform aims to redefine how travelers plan and book accommodations.

#### Background
Traditional hotel booking platforms focus primarily on reserving rooms for fixed durations, offering limited personalization or integration with travel planning. Modern travelers, however, increasingly seek customized experiences and flexible arrangements that fit their schedules and preferences.

To address these gaps:
- The **AI Trip Curator** leverages artificial intelligence to generate tailored itineraries that include nearby attractions, restaurants, and local experiences.

- The **FlexiStay Optimization** system introduces a pay-by-hour or dynamic duration model, enabling users to book rooms for shorter or custom timeframes.

This dual innovation bridges the gap between hotel booking, itinerary planning, and flexible pricing, providing travelers with a more efficient and enjoyable journey experience.

#### Objectives
- Develop an intelligent hotel booking platform that personalizes user experiences.
- Integrate the AI Trip Curator to automatically generate day itineraries based on user preferences, trip duration, and location.
- Implement FlexiStay Optimization to allow flexible booking durations (e.g., hourly or custom stay periods).
- Enhance user satisfaction by offering convenience, flexibility, and meaningful recommendations.
- Promote local tourism and businesses by featuring nearby attractions and establishments.

#### Methodology

1. System Design & Development

  - Develop the hotel booking system using a full‑stack web framework (e.g., Next.js / React / Node.js).
  - Integrate hotel data, availability, and pricing modules.

2. AI Trip Curator Module

  - Use AI algorithms and APIs (e.g., Google Places, OpenAI API, or custom ML models) to recommend attractions, dining spots, and hidden gems.
  - Analyze user preferences and previous bookings to tailor recommendations.
  - Generate a suggested daily itinerary automatically based on location and available time.

3. FlexiStay Optimization

  - Implement dynamic pricing logic for hourly or partial‑day bookings.
  - Use time‑based rate calculations and real‑time room availability data.
  - Include booking options for 6‑hour, 8‑hour, or custom durations.

4. Testing and User Feedback

  - Conduct usability testing to ensure smooth booking flow and accurate AI suggestions.
  - Collect feedback from test users to refine pricing and itinerary features.

5. Deployment

  - Host the web application on a cloud platform (e.g., AWS, Firebase, or Azure).
  - Ensure responsive design for mobile and desktop users.

#### Expected Outputs

- A functional hotel booking website with integrated AI and dynamic pricing features.
- AI Trip Curator module that generates personalized travel itineraries for booked destinations.
- FlexiStay Optimization feature that enables hourly or flexible stay booking with automated price adjustments.
- Enhanced user experience, increasing engagement, satisfaction, and booking conversions.
- Support for local tourism by promoting nearby attractions and businesses.
