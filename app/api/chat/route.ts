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
    let closed = false;

    const sendEvent = async (payload: Record<string, unknown>) => {
      if (closed) return;
      await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    };

    const heartbeatId = setInterval(() => {
      void sendEvent({ type: "heartbeat" });
    }, 2500);

    void (async () => {
      try {
        const result = await runAgent(messages, {
          onStatus: async (message) => {
            await sendEvent({ type: "status", message });
          },
          onTextDelta: async (delta) => {
            await sendEvent({ type: "text_delta", delta });
          },
          onCitation: async (citation) => {
            await sendEvent({ type: "citation", data: citation });
          },
          onArtifact: async (artifact) => {
            await sendEvent({ type: "artifact", data: artifact });
          },
          onPageImage: async (pageImage) => {
            await sendEvent({
              type: "page_image",
              data: { ...pageImage, imageUrl: pageImage.url },
            });
          },
        });

        if (!result.text) {
          await sendEvent({ type: "text_delta", delta: "" });
        }
        await sendEvent({ type: "text_replace", text: result.text });
        await sendEvent({ type: "done" });
      } catch (error) {
        console.error("Chat stream error:", error);
        const message = formatApiErrorForUser(error);
        await sendEvent({ type: "error", error: message });
        await sendEvent({ type: "done" });
      } finally {
        clearInterval(heartbeatId);
        closed = true;
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
