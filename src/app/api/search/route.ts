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
  construction: ["construction companies", "general contractors", "building contractors"],
  logistics: ["logistics companies", "freight forwarding", "supply chain companies"],
  moving: ["moving companies", "movers", "relocation services"],
  warehouse: ["warehouse companies", "warehousing services", "storage facilities"],
  service: ["service companies", "field service companies", "maintenance companies"],
  trucking: ["trucking companies", "freight carriers", "hauling companies"],
  field_services: ["field services", "mobile service companies", "on-site service providers"],
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

interface ScoreBreakdown {
  hasPhone: boolean;
  hasWebsite: boolean;
  hasReviews: boolean;
  highRating: boolean;
  manyReviews: "high" | "medium" | false;
  currentlyOpen: boolean;
}

interface LeadScore {
  score: number;
  label: "Hot" | "Warm" | "Cold";
  breakdown: ScoreBreakdown;
}

function calculateLeadScore(place: GooglePlace): LeadScore {
  let score = 0;

  const hasPhone = !!(place.nationalPhoneNumber || place.internationalPhoneNumber);
  const hasWebsite = !!place.websiteUri;
  const hasReviews = !!(place.userRatingCount && place.userRatingCount > 0);
  const highRating = !!(place.rating && place.rating > 4.0);
  const currentlyOpen = !!place.currentOpeningHours?.openNow;

  let manyReviews: "high" | "medium" | false = false;
  if (place.userRatingCount && place.userRatingCount > 50) manyReviews = "high";
  else if (place.userRatingCount && place.userRatingCount > 20) manyReviews = "medium";

  if (hasPhone) score += 2;
  if (hasWebsite) score += 2;
  if (hasReviews) score += 1;
  if (highRating) score += 1;
  if (manyReviews === "high") score += 2;
  else if (manyReviews === "medium") score += 1;
  if (currentlyOpen) score += 1;

  let label: "Hot" | "Warm" | "Cold";
  if (score >= 7) label = "Hot";
  else if (score >= 4) label = "Warm";
  else label = "Cold";

  return {
    score,
    label,
    breakdown: { hasPhone, hasWebsite, hasReviews, highRating, manyReviews, currentlyOpen },
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  const { location, industries, customQuery } = await request.json();

  if (!location || typeof location !== "string") {
    return NextResponse.json(
      { error: "Location is required" },
      { status: 400 }
    );
  }

  // Build all query strings from industry templates
  const allQueries: string[] = [];
  const requestedIndustries: string[] =
    industries && industries.length > 0
      ? industries
      : Object.keys(INDUSTRY_QUERIES);

  for (const ind of requestedIndustries) {
    const templates = INDUSTRY_QUERIES[ind];
    if (templates) {
      for (const template of templates) {
        allQueries.push(`${template} in ${location}`);
      }
    }
  }

  // Handle custom "Other" query
  if (customQuery && typeof customQuery === "string" && customQuery.trim()) {
    allQueries.push(`${customQuery.trim()} in ${location}`);
  }

  if (allQueries.length === 0) {
    return NextResponse.json({ results: [] });
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
        const { score, label, breakdown } = calculateLeadScore(place);
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
          scoreBreakdown: breakdown,
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
