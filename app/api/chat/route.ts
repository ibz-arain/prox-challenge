import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent";
import { formatApiErrorForUser } from "@/lib/agent/client";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];

    if (!messages.length) {
      return Response.json({ error: "No messages provided" }, { status: 400 });
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (payload: Record<string, unknown>) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    };

    void (async () => {
      try {
        await sendEvent({ type: "status", stage: "searching" });
        const result = await runAgent(
          messages,
          async (delta) => {
            await sendEvent({ type: "text", delta });
          },
          async (stage) => {
            await sendEvent({ type: "status", stage });
          }
        );

        await sendEvent({ type: "citations", data: result.citations });
        await sendEvent({ type: "artifacts", data: result.artifacts });
        await sendEvent({ type: "pageImages", data: result.pageImages });
        await sendEvent({ type: "done" });
      } catch (error) {
        console.error("Chat stream error:", error);
        const message = formatApiErrorForUser(error);
        await sendEvent({ type: "error", error: message });
        await sendEvent({ type: "done" });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = formatApiErrorForUser(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
