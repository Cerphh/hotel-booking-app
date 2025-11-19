"use client";
import { Hotel } from "@/lib/osm-hotels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Users } from "lucide-react";

interface HotelCardProps {
  hotel: Hotel & {
    price?: number;
    availability?: number;
    imageUrl?: string;
    amenities?: string[];
  };
  onBook?: (hotel: Hotel) => void;
  onViewDetails?: (hotel: Hotel) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (hotelId: string) => void;
  isBooked?: boolean;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  onBook,
  onViewDetails,
  isFavorite = false,
  onToggleFavorite,
  isBooked = false,
}) => {
  return (
    <Card className="relative flex h-full overflow-hidden rounded-2xl border border-[#8FABD4]/40 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition-transform hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.28)]">
      {/* Image side */}
      <div className="relative w-40 shrink-0 sm:w-56 md:w-64 bg-muted overflow-hidden group">
        <img
          src={hotel.imageUrl || "https://via.placeholder.com/800x600?text=Hotel"}
          alt={hotel.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        {/* Favorite toggle */}
        {onToggleFavorite && (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => onToggleFavorite(hotel.id)}
            className="absolute right-3 top-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur shadow-lg hover:bg-background"
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorite ? "fill-[#4A70A9] text-[#4A70A9]" : "text-slate-800 dark:text-slate-100"
              }`}
            />
          </Button>
        )}

        {/* Price + availability chip on image */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          {typeof hotel.price === "number" && hotel.price > 0 && (
            <span className="inline-flex items-baseline rounded-full bg-black/75 px-3 py-1 text-[11px] font-semibold text-[#EFECE3] shadow-md">
              <span className="mr-1 text-[10px] uppercase tracking-wide opacity-80">from</span>
              <span className="text-sm">₱{hotel.price.toLocaleString()}</span>
              <span className="ml-1 text-[10px] opacity-80">/night</span>
            </span>
          )}
          {hotel.availability !== undefined && hotel.availability > 0 && (
            <span className="inline-flex items-center rounded-full bg-[#4A70A9]/90 px-3 py-1 text-[11px] text-[#EFECE3] shadow-md">
              <Users className="mr-1 h-3 w-3" />
              {hotel.availability} rooms left
            </span>
          )}
        </div>
      </div>

      {/* Content side */}
      <CardContent className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {hotel.name}
              </h3>
              <div className="flex items-center text-xs text-muted-foreground sm:text-[13px]">
                <MapPin className="mr-1.5 h-3.5 w-3.5 text-[#4A70A9]" />
                <span className="line-clamp-1">
                  {hotel.address || hotel.location || "Batangas, Philippines"}
                </span>
              </div>
            </div>
          </div>

          {/* Amenities / tags */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {hotel.amenities.slice(0, 3).map((amenity, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="border-[#8FABD4]/60 bg-[#8FABD4]/15 px-2 py-0 text-[11px] font-normal capitalize text-[#4A70A9]"
                >
                  {amenity}
                </Badge>
              ))}
              {hotel.amenities.length > 3 && (
                <Badge variant="secondary" className="bg-[#EFECE3] px-2 py-0 text-[11px] text-[#000000]">
                  +{hotel.amenities.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Right / bottom: price + actions */}
        <div className="mt-3 flex flex-col items-stretch gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {typeof hotel.price === "number" && hotel.price > 0 ? (
              <>
                <div className="text-[13px] font-semibold text-foreground">
                  Total from <span className="text-base">₱{hotel.price.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-[#4A70A9]">Includes taxes and charges · Free cancellation</div>
              </>
            ) : (
              <div className="text-[11px] italic">Contact property for pricing</div>
            )}
          </div>

          <div className="flex flex-1 gap-2 sm:flex-none sm:justify-end">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => onViewDetails(hotel)}
              >
                View details
              </Button>
            )}
            {onBook && (
              <Button
                size="sm"
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none"
                disabled={hotel.availability === 0 || isBooked}
                onClick={() => onBook(hotel)}
              >
                {isBooked ? "Booked" : "Book now"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
