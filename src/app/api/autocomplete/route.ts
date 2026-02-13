import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  const { input } = await request.json();

  if (!input || typeof input !== "string" || input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input,
          includedPrimaryTypes: ["locality", "sublocality", "administrative_area_level_1", "postal_code"],
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = await response.json();
    const suggestions = (data.suggestions || [])
      .filter((s: { placePrediction?: unknown }) => s.placePrediction)
      .map((s: { placePrediction: { text: { text: string }; placeId: string } }) => ({
        description: s.placePrediction.text.text,
        placeId: s.placePrediction.placeId,
      }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
