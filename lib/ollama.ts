/**
 * Ollama LLM Integration
 * Fetches nearby recommendations (restaurants, entertainment, attractions)
 * Requires Ollama running locally (default: http://localhost:11434)
 */

export interface NearbyRecommendation {
  name: string;
  type: "restaurant" | "entertainment" | "attraction";
  description: string;
  distance: string;
  imageUrl?: string;
}

export interface OllamaRecommendations {
  recommendations: NearbyRecommendation[];
  error?: string;
}

const OLLAMA_API = process.env.NEXT_PUBLIC_OLLAMA_API || "http://localhost:11434";
const OLLAMA_MODEL = process.env.NEXT_PUBLIC_OLLAMA_MODEL || "mistral";

export async function getNearbyRecommendations(
  latitude: number,
  longitude: number,
  hotelName: string
): Promise<OllamaRecommendations> {
  try {
    const prompt = `You are a helpful travel assistant. Provide exactly 6 nearby recommendations (2 restaurants, 2 entertainment venues, 2 attractions) within 2 km of coordinates (${latitude}, ${longitude}) near the hotel "${hotelName}" in Batangas, Philippines.

Format your response as a JSON array with this exact structure, nothing else:
[
  {"name": "Restaurant Name", "type": "restaurant", "description": "Brief description", "distance": "0.5 km"},
  {"name": "Entertainment Venue", "type": "entertainment", "description": "Brief description", "distance": "1.2 km"},
  {"name": "Attraction Name", "type": "attraction", "description": "Brief description", "distance": "1.8 km"}
]

Provide real or realistic recommendations for Batangas area. Keep descriptions to 1-2 sentences.`;

    const response = await fetch(`${OLLAMA_API}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error(`Ollama API error: ${response.status}`);
      return {
        recommendations: getMockRecommendations(),
        error: "Ollama service unavailable, using mock data",
      };
    }

    const data = await response.json();
    const responseText = data.response || "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("Could not parse JSON from Ollama response");
      return {
        recommendations: getMockRecommendations(),
        error: "Could not parse recommendations",
      };
    }

    const recommendations = JSON.parse(jsonMatch[0]) as NearbyRecommendation[];

    // Add mock image URLs from Unsplash
    const enrichedRecommendations = recommendations.map((rec, idx) => ({
      ...rec,
      imageUrl: getUnsplashImageUrl(rec.type, idx),
    }));

    return { recommendations: enrichedRecommendations };
  } catch (error) {
    console.error("Error fetching Ollama recommendations:", error);
    return {
      recommendations: getMockRecommendations(),
      error: "Failed to fetch recommendations",
    };
  }
}

function getUnsplashImageUrl(type: string, index: number): string {
  const queries: Record<string, string[]> = {
    restaurant: ["restaurant", "food", "cuisine", "dining"],
    entertainment: ["nightlife", "entertainment", "karaoke", "bar"],
    attraction: ["tourist attraction", "landmark", "park", "museum"],
  };

  const typeQueries = queries[type] || ["travel"];
  const query = typeQueries[index % typeQueries.length];
  return `https://source.unsplash.com/400x300/?${encodeURIComponent(query)},batangas`;
}

function getMockRecommendations(): NearbyRecommendation[] {
  return [
    {
      name: "Bulalo Turo Turo",
      type: "restaurant",
      description: "Famous local restaurant serving traditional Batangas bulalo (beef marrow soup) and Filipino dishes.",
      distance: "0.8 km",
      imageUrl: "https://source.unsplash.com/400x300/?restaurant,food",
    },
    {
      name: "Bauan Fishing Port & Market",
      type: "restaurant",
      description: "Fresh seafood market and restaurant with local delicacies and ocean views.",
      distance: "1.5 km",
      imageUrl: "https://source.unsplash.com/400x300/?seafood,market",
    },
    {
      name: "Mabini Night Market",
      type: "entertainment",
      description: "Vibrant night market with local food vendors, street performances, and entertainment.",
      distance: "1.2 km",
      imageUrl: "https://source.unsplash.com/400x300/?nightlife,entertainment",
    },
    {
      name: "Karaoke Nights Bar",
      type: "entertainment",
      description: "Popular karaoke bar with local Filipino bands and great atmosphere for evening fun.",
      distance: "0.6 km",
      imageUrl: "https://source.unsplash.com/400x300/?karaoke,bar",
    },
    {
      name: "Taal Volcano National Park",
      type: "attraction",
      description: "UNESCO World Heritage site with stunning volcanic landscape and hiking trails. One of the most famous landmarks in the region.",
      distance: "2.0 km",
      imageUrl: "https://source.unsplash.com/400x300/?volcano,nature",
    },
    {
      name: "Liliw Heritage Town",
      type: "attraction",
      description: "Historic town known for its traditional Spanish colonial architecture and local handicrafts.",
      distance: "1.8 km",
      imageUrl: "https://source.unsplash.com/400x300/?historic,architecture",
    },
  ];
}
