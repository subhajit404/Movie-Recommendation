import { NextResponse } from "next/server";
import { getBrowseMovies } from "@/lib/omdb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const movies = await getBrowseMovies({
      genre: searchParams.get("genre") ?? "",
      mood: searchParams.get("mood") ?? "",
      era: searchParams.get("era") ?? "",
      runtime: searchParams.get("runtime") ?? "",
      language: searchParams.get("language") ?? "",
    });

    return NextResponse.json({
      results: movies,
      message: "Live browse results from OMDb.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to reach live browse data right now.",
        results: [],
      },
      { status: 500 }
    );
  }
}
