import { NextRequest, NextResponse } from "next/server";

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  types?: string[];
  businessStatus?: string;
  currentOpeningHours?: { openNow?: boolean };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  const { query } = await request.json();

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.rating",
            "places.userRatingCount",
            "places.websiteUri",
            "places.googleMapsUri",
            "places.types",
            "places.businessStatus",
            "places.currentOpeningHours",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 20,
          rankPreference: "RELEVANCE",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Places API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch from Google Places API" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const places: GooglePlace[] = data.places || [];

    // Filter to operational businesses and sort by rating * reviews for warmest leads
    const results = places
      .filter((p) => !p.businessStatus || p.businessStatus === "OPERATIONAL")
      .map((place) => ({
        id: place.id,
        name: place.displayName?.text || "Unknown",
        address: place.formattedAddress || "",
        phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
        rating: place.rating ?? null,
        userRatingsTotal: place.userRatingCount ?? null,
        website: place.websiteUri || "",
        mapsUrl: place.googleMapsUri || "",
        types: place.types || [],
        openNow: place.currentOpeningHours?.openNow ?? null,
      }))
      .sort((a, b) => {
        // Prioritize leads with phone + website (warmest), then by rating score
        const aScore =
          (a.phone ? 2 : 0) +
          (a.website ? 2 : 0) +
          (a.rating ?? 0) * ((a.userRatingsTotal ?? 0) > 0 ? 1 : 0);
        const bScore =
          (b.phone ? 2 : 0) +
          (b.website ? 2 : 0) +
          (b.rating ?? 0) * ((b.userRatingsTotal ?? 0) > 0 ? 1 : 0);
        return bScore - aScore;
      });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
