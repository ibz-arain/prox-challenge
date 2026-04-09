import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];

    if (!messages.length) {
      return Response.json({ error: "No messages provided" }, { status: 400 });
    }

    const result = await runAgent(messages);

    return Response.json({
      text: result.text,
      citations: result.citations,
      artifacts: result.artifacts,
      pageImages: result.pageImages,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
