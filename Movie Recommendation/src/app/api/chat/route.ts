import { NextResponse } from "next/server";
import { getChatRecommendations } from "@/lib/omdb";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      history?: string[];
    };

    const prompt = body.prompt?.trim() ?? "";
    const history = body.history ?? [];

    const recommendations = await getChatRecommendations(prompt, history);

    return NextResponse.json({
      message:
        "These picks are coming from live OMDb data right now. Keep refining with prompts like 'more recent', 'shorter', or 'less intense'.",
      recommendations,
      dataSource: "Live OMDb search",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to reach live movie data right now.",
        recommendations: [],
      },
      { status: 500 }
    );
  }
}
