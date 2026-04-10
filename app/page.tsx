"use client";

import { useState, useCallback, useRef } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import AppNav from "@/components/AppNav";
import { CHAT_PAGE_MAX_WIDTH_CLASS } from "@/lib/chatLayout";
import type {
  ChatMessage,
  Citation,
  Artifact,
  PageImage,
  StreamEvent,
} from "@/lib/types";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [landingSessionKey, setLandingSessionKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusTrail, setStatusTrail] = useState<string[]>([]);
  const [hasTextStarted, setHasTextStarted] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const clearTrailTimeoutRef = useRef<number | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  const resetApp = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLandingSessionKey((k) => k + 1);
    setMessages([]);
    setIsLoading(false);
    setStatusTrail([]);
    setHasTextStarted(false);
    setStreamComplete(false);
    setHighlightedSourceId(null);
    if (clearTrailTimeoutRef.current) {
      window.clearTimeout(clearTrailTimeoutRef.current);
      clearTrailTimeoutRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, image?: string) => {
      const userMessage: ChatMessage = {
        id: makeId("user"),
        role: "user",
        content,
        image,
      };
      const newMessages = [...messages, userMessage];
      const assistantMessageIndex = newMessages.length;
      const assistantMessageId = makeId("assistant");
      setMessages([
        ...newMessages,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);
      setIsLoading(true);
      setStatusTrail([]);
      setHasTextStarted(false);
      setStreamComplete(false);
      setHighlightedSourceId(null);
      if (clearTrailTimeoutRef.current) {
        window.clearTimeout(clearTrailTimeoutRef.current);
        clearTrailTimeoutRef.current = null;
      }

      streamAbortRef.current?.abort();
      const ac = new AbortController();
      streamAbortRef.current = ac;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
          signal: ac.signal,
        });

        if (!response.ok) {
          const raw = await response.text();
          try {
            const err = JSON.parse(raw);
            throw new Error(err.error || "Request failed");
          } catch {
            throw new Error(raw || "Request failed");
          }
        }

        if (!response.body) {
          throw new Error("Streaming response body is missing.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        let citations: Citation[] = [];
        let artifacts: Artifact[] = [];
        let pageImages: PageImage[] = [];
        let receivedDone = false;

        const updateAssistantMessage = (updates: Partial<ChatMessage>) => {
          setMessages((prev) => {
            if (!prev[assistantMessageIndex]) return prev;
            const next = [...prev];
            next[assistantMessageIndex] = {
              ...next[assistantMessageIndex],
              ...updates,
            };
            return next;
          });
        };

        const appendStatus = (line: string) => {
          setStatusTrail((prev) => [...prev, line]);
        };

        const applyEvent = (payload: StreamEvent) => {
          const eventType = payload.type;
          if (eventType === "text_delta") {
            const delta = typeof payload.delta === "string" ? payload.delta : "";
            if (!hasTextStarted && delta.length > 0) {
              setHasTextStarted(true);
            }
            assistantText += delta;
            updateAssistantMessage({ content: assistantText });
            return;
          }

          if (eventType === "status") {
            const line = typeof payload.message === "string" ? payload.message : "";
            if (line) {
              appendStatus(line);
            }
            return;
          }

          if (eventType === "citation") {
            const item = payload.data as Citation | undefined;
            if (!item || typeof item.pageNumber !== "number") return;
            const exists = citations.some(
              (citation) =>
                citation.pageNumber === item.pageNumber &&
                citation.source === item.source
            );
            if (!exists) {
              citations = [...citations, item];
              updateAssistantMessage({ citations });
            }
            return;
          }

          if (eventType === "artifact") {
            const item = payload.data as Artifact | undefined;
            if (!item || typeof item.title !== "string") return;
            artifacts = [...artifacts, item];
            updateAssistantMessage({ artifacts });
            return;
          }

          if (eventType === "page_image") {
            const item = payload.data as PageImage | undefined;
            if (!item || typeof item.pageNumber !== "number") return;
            const normalized: PageImage = {
              ...item,
              imageUrl: item.imageUrl ?? item.url,
              url: item.url ?? item.imageUrl ?? "",
            };
            const exists = pageImages.some(
              (pageImage) =>
                pageImage.pageNumber === normalized.pageNumber &&
                pageImage.source === normalized.source
            );
            if (!exists) {
              pageImages = [...pageImages, normalized];
              updateAssistantMessage({ pageImages });
            }
            return;
          }

          if (eventType === "error") {
            throw new Error(
              typeof payload.error === "string"
                ? payload.error
                : "Stream failed unexpectedly."
            );
          }

          if (eventType === "done") {
            receivedDone = true;
            setStreamComplete(true);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const boundary = buffer.indexOf("\n\n");
            if (boundary === -1) break;
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const dataLines = rawEvent
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim());
            if (!dataLines.length) continue;
            try {
              const payload = JSON.parse(dataLines.join("\n")) as StreamEvent;
              applyEvent(payload);
            } catch {
              // Ignore malformed chunks so stream can continue.
            }
          }
        }

        if (!receivedDone) {
          throw new Error("Response stream ended before completion.");
        }
      } catch (error) {
        const aborted =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");
        if (aborted) {
          setStreamComplete(true);
          return;
        }

        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        setMessages((prev) => {
          const next = [...prev];
          const fallbackMessage: ChatMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: `Sorry, I encountered an error: ${errMsg}. If Anthropic credits are low, add OPENROUTER_API_KEY — the app will fall back automatically. Otherwise check your API keys and that manuals exist under files/.`,
          };

          if (
            next[assistantMessageIndex] &&
            next[assistantMessageIndex].role === "assistant"
          ) {
            next[assistantMessageIndex] = fallbackMessage;
            return next;
          }

          return [...next, fallbackMessage];
        });
      } finally {
        if (streamAbortRef.current === ac) {
          streamAbortRef.current = null;
        }
        setIsLoading(false);
        if (clearTrailTimeoutRef.current) {
          window.clearTimeout(clearTrailTimeoutRef.current);
        }
        clearTrailTimeoutRef.current = window.setTimeout(() => {
          setStatusTrail([]);
        }, 320);
      }
    },
    [hasTextStarted, messages]
  );

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--color-bg)]">
      <AppNav onHome={resetApp} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-16">
        <div
          className={`mx-auto flex h-full w-full min-w-0 flex-col bg-[var(--color-bg)] ${CHAT_PAGE_MAX_WIDTH_CLASS}`}
        >
          <ChatPanel
            landingSessionKey={landingSessionKey}
            messages={messages}
            isLoading={isLoading}
            statusTrail={statusTrail}
            hasTextStarted={hasTextStarted}
            streamComplete={streamComplete}
            highlightedSourceId={highlightedSourceId}
            onHighlightSource={setHighlightedSourceId}
            onSend={sendMessage}
            onCancel={cancelStream}
          />
        </div>
      </div>
    </div>
  );
}
