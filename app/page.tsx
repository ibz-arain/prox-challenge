"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import AppNav from "@/components/AppNav";
import { CHAT_PAGE_MAX_WIDTH_CLASS } from "@/lib/chatLayout";
import SourceViewerPanel from "@/components/sources/SourceViewerPanel";
import { buildPageImageFromCitation } from "@/lib/evidence";
import { CHAT_SESSION_STORAGE_KEY } from "@/lib/chat-session-key";
import type {
  ChatMessage,
  Citation,
  Artifact,
  PageImage,
  SelectedSource,
  StreamEvent,
} from "@/lib/types";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSelectedSourceSnapshot(
  messages: ChatMessage[],
  sourceId: string | null
): SelectedSource | null {
  if (!sourceId) return null;
  for (const message of messages) {
    const messageId = message.id;
    if (!messageId || !message.citations?.length) continue;
    for (const citation of message.citations) {
      const candidateId = `source-${messageId}-${citation.source}-${citation.pageNumber}`;
      if (candidateId !== sourceId) continue;
      const pageImage = message.pageImages?.find(
        (item) => item.source === citation.source && item.pageNumber === citation.pageNumber
      );
      return {
        sourceId: candidateId,
        messageId,
        citation,
        pageImage: buildPageImageFromCitation(citation, pageImage, {
          highlightText: citation.excerpt,
        }),
      };
    }
  }
  return null;
}

export default function Home() {
  const [landingSessionKey, setLandingSessionKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusTrail, setStatusTrail] = useState<string[]>([]);
  const [hasTextStarted, setHasTextStarted] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const clearTrailTimeoutRef = useRef<number | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const selectedSource = useMemo(
    () => buildSelectedSourceSnapshot(messages, selectedSourceId),
    [messages, selectedSourceId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (!raw) {
        setIsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        selectedSourceId?: string | null;
      };
      const savedMessages = Array.isArray(parsed.messages) ? parsed.messages : [];
      setMessages(savedMessages);
      setSelectedSourceId(parsed.selectedSourceId ?? null);
    } catch {
      /* ignore hydration errors */
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({
        messages,
        selectedSourceId,
      })
    );
  }, [isHydrated, messages, selectedSourceId]);

  useEffect(() => {
    if (!selectedSourceId) return;
    if (selectedSource) return;
    setSelectedSourceId(null);
  }, [selectedSource, selectedSourceId]);

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
    setSelectedSourceId(null);
    if (clearTrailTimeoutRef.current) {
      window.clearTimeout(clearTrailTimeoutRef.current);
      clearTrailTimeoutRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    }
  }, []);

  const handleSelectSource = useCallback((source: SelectedSource) => {
    setSelectedSourceId(source.sourceId);
    setHighlightedSourceId(source.sourceId);
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
      setSelectedSourceId(null);
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
        let queuedDelta = "";
        let citations: Citation[] = [];
        let artifacts: Artifact[] = [];
        let pageImages: PageImage[] = [];
        let receivedDone = false;
        let textStarted = false;
        let flushTimeoutId: number | null = null;

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

        const flushText = () => {
          flushTimeoutId = null;
          if (!queuedDelta) return;
          assistantText += queuedDelta;
          queuedDelta = "";
          updateAssistantMessage({ content: assistantText });
        };

        const scheduleTextFlush = () => {
          if (flushTimeoutId !== null) return;
          flushTimeoutId = window.setTimeout(flushText, 32);
        };

        const applyEvent = (payload: StreamEvent) => {
          const eventType = payload.type;
          if (eventType === "text_delta") {
            const delta = typeof payload.delta === "string" ? payload.delta : "";
            if (!textStarted && delta.length > 0) {
              textStarted = true;
              setHasTextStarted(true);
            }
            queuedDelta += delta;
            scheduleTextFlush();
            return;
          }

          if (eventType === "text_replace") {
            if (flushTimeoutId !== null) {
              window.clearTimeout(flushTimeoutId);
              flushTimeoutId = null;
            }
            queuedDelta = "";
            assistantText = typeof payload.text === "string" ? payload.text : assistantText;
            if (!textStarted && assistantText.length > 0) {
              textStarted = true;
              setHasTextStarted(true);
            }
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

          if (eventType === "heartbeat") {
            return;
          }

          if (eventType === "done") {
            flushText();
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
          flushText();
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
            content: `Sorry, I encountered an error: ${errMsg}. Check your ANTHROPIC_API_KEY in .env and make sure the manuals exist under files/.`,
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
      }
    },
    [messages]
  );

  const evidenceOpen = !!selectedSource;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--color-bg)">
      <AppNav onHome={resetApp} evidenceOpen={evidenceOpen} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--color-bg) px-4 pt-20 pb-6 sm:px-6 md:order-1 md:px-4 md:pb-6 lg:px-6">
          <div
            className={`mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${CHAT_PAGE_MAX_WIDTH_CLASS}`}
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
              selectedSourceId={selectedSourceId}
              onSelectSource={handleSelectSource}
              onSend={sendMessage}
              onCancel={cancelStream}
            />
          </div>
        </div>

        {/* Mobile scrim — sits behind the evidence sheet but above messages */}
        {evidenceOpen && (
          <div
            className="fixed inset-0 z-8 bg-black/50 md:hidden"
            aria-hidden="true"
            onClick={() => {
              setSelectedSourceId(null);
              setHighlightedSourceId(null);
            }}
          />
        )}

        {/*
          Evidence panel:
          • Mobile (<md): position:fixed overlay at viewport bottom — never touches the
            chat column so the input is never displaced.
          • Desktop (md+): position:static flex-row side panel that narrows the chat column.
        */}
        <aside
          aria-hidden={!evidenceOpen}
          aria-label="Evidence sheet"
          className={`order-2 flex min-h-0 flex-col overflow-hidden bg-neutral-950 shadow-[inset_1px_0_0_rgba(255,255,255,0.06)] transition-[width,max-height] duration-300 ease-[cubic-bezier(0.25,0.82,0.2,1)] motion-reduce:transition-none
            fixed inset-x-0 bottom-0
            md:static md:h-full md:max-h-none md:min-h-0 md:shrink-0 md:self-stretch
            ${
              evidenceOpen
                ? "z-9 max-h-[min(42vh,22rem)] border-t border-white/10 md:z-auto md:w-lg md:border-l md:border-t-0 md:border-white/10 md:pb-0 md:pr-0"
                : "pointer-events-none max-h-0 md:pointer-events-auto md:z-auto md:max-h-none md:w-0"
            }`}
        >
          {evidenceOpen ? (
            <SourceViewerPanel
              source={selectedSource!}
              onClose={() => {
                setSelectedSourceId(null);
                setHighlightedSourceId(null);
              }}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
