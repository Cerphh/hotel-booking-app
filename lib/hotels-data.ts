// Mock hotel data
export interface Hotel {
  id: string;
  name: string;
  description: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  amenities: string[];
  availability: number;
  hourlyCostRange?: { min: number; max: number };
}

export const MOCK_HOTELS: Hotel[] = [
  {
    id: "hotel-1",
    name: "Luxury Ocean View Resort",
    description: "Experience breathtaking ocean views",
    location: "Malibu, California",
    price: 450,
    rating: 4.8,
    reviews: 324,
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500&h=400&fit=crop",
    amenities: ["WiFi", "Pool", "Gym", "Restaurant", "Spa", "Beach Access"],
    availability: 5,
    hourlyCostRange: { min: 60, max: 120 },
  },
  {
    id: "hotel-2",
    name: "Downtown Modern Hotel",
    description: "Contemporary luxury in the heart of the city",
    location: "New York, New York",
    price: 320,
    rating: 4.6,
    reviews: 512,
    image: "https://images.unsplash.com/photo-1595909352763-b798883426dd?w=500&h=400&fit=crop",
    amenities: ["WiFi", "Gym", "Restaurant", "Business Center", "Concierge"],
    availability: 8,
    hourlyCostRange: { min: 45, max: 90 },
  },
  {
    id: "hotel-3",
    name: "Cozy Mountain Retreat",
    description: "Perfect mountain getaway with stunning views",
    location: "Aspen, Colorado",
    price: 280,
    rating: 4.7,
    reviews: 189,
    image: "https://images.unsplash.com/photo-1551632786-de41ec28a16b?w=500&h=400&fit=crop",
    amenities: ["WiFi", "Fireplace", "Mountain Bike", "Hiking", "Hot Tub"],
    availability: 3,
    hourlyCostRange: { min: 35, max: 75 },
  },
  {
    id: "hotel-4",
    name: "Tropical Paradise Resort",
    description: "Island living at its finest with pristine beaches",
    location: "Maui, Hawaii",
    price: 520,
    rating: 4.9,
    reviews: 401,
    image: "https://images.unsplash.com/photo-1566650885640-65e3a54b9eb8?w=500&h=400&fit=crop",
    amenities: ["WiFi", "Pool", "Beach", "Water Sports", "Spa", "Bar"],
    availability: 2,
    hourlyCostRange: { min: 80, max: 150 },
  },
  {
    id: "hotel-5",
    name: "Historic European Boutique",
    description: "Charming historic hotel with old-world elegance",
    location: "Paris, France",
    price: 380,
    rating: 4.5,
    reviews: 276,
    image: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=500&h=400&fit=crop",
    amenities: ["WiFi", "Restaurant", "Concierge", "Library", "Wine Cellar"],
    availability: 6,
    hourlyCostRange: { min: 55, max: 110 },
  },
  {
    id: "hotel-6",
    name: "Desert Luxury Oasis",
    description: "Modern luxury meets desert tranquility",
    location: "Scottsdale, Arizona",
    price: 400,
    rating: 4.7,
    reviews: 298,
    image: "https://images.unsplash.com/photo-1561599810-10cb3c94f357?w=500&h=400&fit=crop",
    amenities: ["WiFi", "Pool", "Golf Course", "Spa", "Restaurant"],
    availability: 7,
    hourlyCostRange: { min: 50, max: 100 },
  },
];
