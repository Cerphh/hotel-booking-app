# HotBook: An Intelligent and Flexible Hotel Booking Platform

This project presents an innovative Hotel Booking Web Application that enhances the traditional booking experience through artificial intelligence and dynamic pricing technology. The system integrates an AI Trip Curator that personalizes travel recommendations based on user interests, and a FlexiStay Optimization feature that allows flexible stay durations with real-time price adjustments. By combining convenience, personalization, and flexibility, this platform aims to redefine how travelers plan and book accommodations.

## Overview

HotBook is a demo hotel booking application built with Next.js (App Router). It showcases hotel listings, a booking flow, nearby recommendations (via Ollama / OpenAI fallback + Overpass), and Firebase authentication for Google sign-in.

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

For deeper, developer-oriented documentation see `TECHNICAL_DOCUMENTATION.md` and `PROJECT_DOCUMENTATION.md`.

## Background
Traditional hotel booking platforms focus primarily on reserving rooms for fixed durations, offering limited personalization or integration with travel planning. Modern travelers, however, increasingly seek customized experiences and flexible arrangements that fit their schedules and preferences.

To address these gaps:

- The **AI Trip Curator** leverages artificial intelligence to generate tailored itineraries that include nearby attractions, restaurants, and local experiences.

- The **FlexiStay Optimization** system introduces a pay-by-hour or dynamic duration model, enabling users to book rooms for shorter or custom timeframes.

This dual innovation bridges the gap between hotel booking, itinerary planning, and flexible pricing, providing travelers with a more efficient and enjoyable journey experience.

## Objectives

- Develop an intelligent hotel booking platform that personalizes user experiences.

- Integrate the AI Trip Curator to automatically generate day itineraries based on user preferences, trip duration, and location.

- Implement FlexiStay Optimization to allow flexible booking durations (e.g., hourly or custom stay periods).

- Enhance user satisfaction by offering convenience, flexibility, and meaningful recommendations.

- Promote local tourism and businesses by featuring nearby attractions and establishments.

## Methodology

### System Design & Development

- Develop the hotel booking system using a full-stack web framework (Next.js / React / Node.js).

- Integrate hotel data, availability, and pricing modules.

### AI Trip Curator Module

- Use AI algorithms and APIs (e.g., Google Places, OpenAI API, or custom ML models) to recommend attractions, dining spots, and hidden gems.

- Analyze user preferences and previous bookings to tailor recommendations.

- Generate a suggested daily itinerary automatically based on location and available time.

### FlexiStay Optimization

- Implement dynamic pricing logic for hourly or partial-day bookings.

- Use time-based rate calculations and real-time room availability data.

- Include booking options for 6-hour, 8-hour, or custom durations.

### Testing and User Feedback

- Conduct usability testing to ensure smooth booking flow and accurate AI suggestions.

- Collect feedback from test users to refine pricing and itinerary features.

### Deployment

- Host the web application on a cloud platform (e.g., AWS, Firebase, or Azure).

- Ensure responsive design for mobile and desktop users.

## Expected Outputs

- A functional hotel booking website with integrated AI and dynamic pricing features.

- AI Trip Curator module that generates personalized travel itineraries for booked destinations.

- FlexiStay Optimization feature that enables hourly or flexible stay booking with automated price adjustments.

- Enhanced user experience, increasing engagement, satisfaction, and booking conversions.

- Support for local tourism by promoting nearby attractions and businesses.

Documentation:

- Developer guide & quick notes: `PROJECT_DOCUMENTATION.md`
- Technical deep-dive: `TECHNICAL_DOCUMENTATION.md`