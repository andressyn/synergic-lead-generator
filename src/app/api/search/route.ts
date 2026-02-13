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
  editorialSummary?: { text: string };
  reviews?: Array<{
    relativePublishTimeDescription?: string;
    rating?: number;
    text?: { text: string };
    authorAttribution?: { displayName?: string };
  }>;
  primaryTypeDisplayName?: { text: string };
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
}

const INDUSTRY_QUERIES: Record<string, string[]> = {
  moving: ["moving companies", "movers", "relocation services"],
  warehouse: ["warehouse companies", "warehousing services", "storage warehouse"],
};

const FIELD_MASK = [
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
  "places.editorialSummary",
  "places.reviews",
  "places.primaryTypeDisplayName",
  "places.regularOpeningHours",
].join(",");

interface LeadScore {
  score: number;
  label: "Hot" | "Warm" | "Cold";
}

function calculateLeadScore(place: GooglePlace): LeadScore {
  let score = 0;

  if (place.nationalPhoneNumber || place.internationalPhoneNumber) score += 2;
  if (place.websiteUri) score += 2;
  if (place.userRatingCount && place.userRatingCount > 0) score += 1;
  if (place.rating && place.rating > 4.0) score += 1;
  if (place.userRatingCount && place.userRatingCount > 50) score += 2;
  else if (place.userRatingCount && place.userRatingCount > 20) score += 1;
  if (place.currentOpeningHours?.openNow) score += 1;

  let label: "Hot" | "Warm" | "Cold";
  if (score >= 7) label = "Hot";
  else if (score >= 4) label = "Warm";
  else label = "Cold";

  return { score, label };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  const { location, industries } = await request.json();

  if (!location || typeof location !== "string") {
    return NextResponse.json(
      { error: "Location is required" },
      { status: 400 }
    );
  }

  const requestedIndustries: string[] =
    industries && industries.length > 0
      ? industries
      : ["moving", "warehouse"];

  // Build all query strings from industry templates
  const allQueries: string[] = [];
  for (const ind of requestedIndustries) {
    const templates = INDUSTRY_QUERIES[ind];
    if (templates) {
      for (const template of templates) {
        allQueries.push(`${template} in ${location}`);
      }
    }
  }

  try {
    // Execute all queries in parallel
    const fetchPromises = allQueries.map((textQuery) =>
      fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: 20,
          rankPreference: "RELEVANCE",
        }),
      })
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return (data.places || []) as GooglePlace[];
        })
        .catch(() => [] as GooglePlace[])
    );

    const allPlacesArrays = await Promise.all(fetchPromises);
    const allPlaces = allPlacesArrays.flat();

    // Deduplicate by place ID
    const uniquePlaces = Array.from(
      new Map(allPlaces.map((p) => [p.id, p])).values()
    );

    // Filter, score, and sort
    const results = uniquePlaces
      .filter((p) => !p.businessStatus || p.businessStatus === "OPERATIONAL")
      .map((place) => {
        const { score, label } = calculateLeadScore(place);
        const mostRecentReview = place.reviews?.[0];

        return {
          id: place.id,
          name: place.displayName?.text || "Unknown",
          address: place.formattedAddress || "",
          phone:
            place.internationalPhoneNumber ||
            place.nationalPhoneNumber ||
            "",
          rating: place.rating ?? null,
          userRatingsTotal: place.userRatingCount ?? null,
          website: place.websiteUri || "",
          mapsUrl: place.googleMapsUri || "",
          types: place.types || [],
          openNow: place.currentOpeningHours?.openNow ?? null,
          description: place.editorialSummary?.text || "",
          businessType: place.primaryTypeDisplayName?.text || "",
          weekdayHours:
            place.regularOpeningHours?.weekdayDescriptions || [],
          leadScore: score,
          leadLabel: label,
          recentReview: mostRecentReview
            ? {
                text: mostRecentReview.text?.text || "",
                rating: mostRecentReview.rating ?? null,
                author:
                  mostRecentReview.authorAttribution?.displayName || "",
                timeDescription:
                  mostRecentReview.relativePublishTimeDescription || "",
              }
            : null,
        };
      })
      .sort((a, b) => b.leadScore - a.leadScore);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
