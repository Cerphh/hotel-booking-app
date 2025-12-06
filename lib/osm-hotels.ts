// lib/osm-hotels.ts
import axios from "axios";

export interface Hotel {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location: string;
  address?: string;
  imageUrl?: string;
  amenities?: string[];
}

export const CITY_CENTERS: Record<string, { lat: number; lon: number }> = {
  Batangas: { lat: 13.7569, lon: 121.0583 },
};

const OVERPASS_URL = "https://lz4.overpass-api.de/api/interpreter";

// Map OSM tags to user-friendly amenity names
function parseOSMAmenities(tags: any): string[] {
  const amenities: string[] = [];
  
  // WiFi / Internet
  if (tags.internet_access === "yes" || tags.internet_access === "wlan" || tags['internet_access:fee'] === "no") {
    amenities.push("WiFi");
  }
  
  // Swimming pool
  if (tags.swimming_pool === "yes" || tags.leisure === "swimming_pool") {
    amenities.push("Pool");
  }
  
  // Fitness / Gym
  if (tags.sport === "fitness" || tags.leisure === "fitness_centre" || tags.gym === "yes") {
    amenities.push("Gym");
  }
  
  // Restaurant
  if (tags.restaurant === "yes" || tags.amenity === "restaurant") {
    amenities.push("Restaurant");
  }
  
  // Spa
  if (tags.spa === "yes" || tags.leisure === "spa" || tags.wellness === "spa") {
    amenities.push("Spa");
  }
  
  // Beach access
  if (tags.beach === "yes" || tags.beach_access === "yes") {
    amenities.push("Beach Access");
  }
  
  // Bar
  if (tags.bar === "yes" || tags.amenity === "bar") {
    amenities.push("Bar");
  }
  
  // Room service
  if (tags.room_service === "yes" || tags['service:room'] === "yes") {
    amenities.push("Room Service");
  }
  
  // Parking
  if (tags.parking === "yes" || tags.amenity === "parking") {
    amenities.push("Parking");
  }
  
  // Air conditioning
  if (tags.air_conditioning === "yes" || tags['climate_control'] === "yes") {
    amenities.push("Air Conditioning");
  }
  
  // Concierge
  if (tags.concierge === "yes") {
    amenities.push("Concierge");
  }
  
  // Pet friendly
  if (tags.pets === "yes" || tags.pets_allowed === "yes" || tags.dog === "yes") {
    amenities.push("Pet Friendly");
  }
  
  // 24/7 Front desk
  if (tags.reception === "24/7" || tags['opening_hours'] === "24/7") {
    amenities.push("24/7 Front Desk");
  }
  
  // Laundry
  if (tags.laundry === "yes" || tags['service:laundry'] === "yes") {
    amenities.push("Laundry Service");
  }
  
  // Airport shuttle
  if (tags.airport_shuttle === "yes" || tags.shuttle === "yes") {
    amenities.push("Airport Shuttle");
  }
  
  // Sauna
  if (tags.sauna === "yes" || tags.leisure === "sauna") {
    amenities.push("Sauna");
  }
  
  return amenities;
}

// Fallback amenities when OSM data is incomplete
function getRandomAmenities(min: number = 4, max: number = 8): string[] {
  const allAmenities = [
    "WiFi", "Pool", "Gym", "Restaurant", "Spa", "Beach Access",
    "Bar", "Room Service", "Parking", "Air Conditioning", "Concierge",
    "Business Center", "Conference Rooms", "Pet Friendly", "24/7 Front Desk",
    "Laundry Service", "Airport Shuttle", "Hot Tub", "Sauna"
  ];
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...allAmenities].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function fetchWithRetry(query: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(OVERPASS_URL, query, {
        headers: { "Content-Type": "text/plain" },
        timeout: 20000,
      });
      return res.data;
    } catch (err) {
      await new Promise((r) => setTimeout(r, (i + 1) * 2000));
    }
  }
  return null;
}

export async function searchHotelsByCity(city: string): Promise<Hotel[]> {
  // If the requested city is Batangas (province), query Overpass for the Batangas
  // administrative area so results are limited to the province boundaries.
  const isBatangas = city?.toLowerCase().includes("batangas");

  let query: string;
  if (isBatangas) {
    query = `
      [out:json][timeout:40];
      area["name"="Batangas"]["boundary"="administrative"]->.searchArea;
      node["tourism"~"hotel|motel|hostel|apartment"](area.searchArea);
      out tags center;
    `;
  } else {
    // compute an approximate bbox around the city center when available
    const center = CITY_CENTERS[city];
    let bboxStr = `(13.5,120.7,14.1,121.2)`; // fallback bbox
    if (center) {
      const lat = center.lat;
      const lon = center.lon;
      const delta = 0.4; // ~40km box
      const south = lat - delta;
      const west = lon - delta;
      const north = lat + delta;
      const east = lon + delta;
      bboxStr = `(${south},${west},${north},${east})`;
    }

    query = `
      [out:json][timeout:40];
      node["tourism"~"hotel|motel|hostel|apartment"]${bboxStr};
      out tags center;
    `;
  }

  const data = await fetchWithRetry(query);
  if (!data?.elements) return [];

  return data.elements.slice(0, 120).map((el: any) => {
    // Try to extract amenities from OSM tags
    const osmAmenities = parseOSMAmenities(el.tags || {});
    
    // If OSM has amenities, use them; otherwise generate random ones
    const amenities = osmAmenities.length > 0 ? osmAmenities : getRandomAmenities();
    
    return {
      id: String(el.id),
      name: el.tags?.name || "Unnamed Hotel",
      latitude: el.lat,
      longitude: el.lon,
      location: "Batangas",
      imageUrl: `https://source.unsplash.com/600x400/?hotel,${encodeURIComponent(
        el.tags?.name || "hotel"
      )}`,
      amenities,
    };
  });
}
