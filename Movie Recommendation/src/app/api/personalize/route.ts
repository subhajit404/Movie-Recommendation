import { NextResponse } from "next/server";
import { getPersonalizedRecommendations } from "@/lib/omdb";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ratings?: Array<{
        id: string;
        title: string;
        value: number;
        tmdbId?: number;
      }>;
    };

    const recommendations = await getPersonalizedRecommendations(body.ratings ?? []);

    return NextResponse.json({
      message:
        "These picks come from live OMDb data and are weighted toward the genres you keep rating highly.",
      recommendations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to build personalized recommendations from live data right now.",
        recommendations: [],
      },
      { status: 500 }
    );
  }
}
