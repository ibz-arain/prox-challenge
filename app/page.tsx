"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import EvidencePanel from "@/components/evidence/EvidencePanel";
import type { ChatMessage, Citation, Artifact, PageImage } from "@/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStage, setAgentStage] = useState<"searching" | "generating" | null>(
    null
  );
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [activeArtifacts, setActiveArtifacts] = useState<Artifact[]>([]);
  const [activePageImages, setActivePageImages] = useState<PageImage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  const sendMessage = useCallback(
    async (content: string, image?: string) => {
      const userMessage: ChatMessage = { role: "user", content, image };
      const newMessages = [...messages, userMessage];
      const assistantMessageIndex = newMessages.length;
      setMessages([...newMessages, { role: "assistant", content: "" }]);
      setIsLoading(true);
      setAgentStage("searching");
      setActiveCitations([]);
      setActiveArtifacts([]);
      setActivePageImages([]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
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

        const applyEvent = (payload: Record<string, unknown>) => {
          const eventType = payload.type;
          if (eventType === "text") {
            const delta = typeof payload.delta === "string" ? payload.delta : "";
            assistantText += delta;
            updateAssistantMessage({ content: assistantText });
            return;
          }

          if (eventType === "status") {
            const stage = payload.stage;
            if (stage === "searching" || stage === "generating") {
              setAgentStage(stage);
            }
            return;
          }

          if (eventType === "citations" && Array.isArray(payload.data)) {
            citations = payload.data as Citation[];
            setActiveCitations(citations);
            updateAssistantMessage({ citations });
            return;
          }

          if (eventType === "artifacts" && Array.isArray(payload.data)) {
            artifacts = payload.data as Artifact[];
            setActiveArtifacts(artifacts);
            updateAssistantMessage({ artifacts });
            return;
          }

          if (eventType === "pageImages" && Array.isArray(payload.data)) {
            pageImages = payload.data as PageImage[];
            setActivePageImages(pageImages);
            updateAssistantMessage({ pageImages });
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

            const payload = JSON.parse(dataLines.join("\n")) as Record<
              string,
              unknown
            >;
            applyEvent(payload);
          }
        }

        if (!receivedDone) {
          throw new Error("Response stream ended before completion.");
        }
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        setMessages((prev) => {
          const next = [...prev];
          const fallbackMessage: ChatMessage = {
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
        setIsLoading(false);
        setAgentStage(null);
      }
    },
    [messages]
  );

  const handleSamplePrompt = useCallback(
    (prompt: string) => {
      if (!isLoading) {
        setIsSidebarOpen(false);
        sendMessage(prompt);
      }
    },
    [isLoading, sendMessage]
  );

  const hasEvidence =
    activeCitations.length > 0 ||
    activeArtifacts.length > 0 ||
    activePageImages.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Left Sidebar */}
      <div className="w-72 flex-shrink-0 hidden lg:block">
        <Sidebar onSamplePrompt={handleSamplePrompt} />
      </div>

      {/* Mobile Sidebar Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-xl">
            <Sidebar onSamplePrompt={handleSamplePrompt} />
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)]">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          agentStage={agentStage}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenEvidence={() => setIsEvidenceOpen(true)}
          canOpenEvidence={hasEvidence}
          onSend={sendMessage}
        />
      </div>

      {/* Right Evidence Panel */}
      <div className="w-80 flex-shrink-0 hidden xl:block bg-[var(--color-surface)]">
        <EvidencePanel
          citations={activeCitations}
          artifacts={activeArtifacts}
          pageImages={activePageImages}
        />
      </div>

      {/* Mobile / Tablet Evidence Sheet */}
      {isEvidenceOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsEvidenceOpen(false)}
            aria-label="Close sources panel"
          />
          <div className="absolute bottom-0 left-0 right-0 h-[78vh] rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
            <div className="flex items-center justify-between px-4 pb-2">
              <p className="text-sm font-medium">Sources & Artifacts</p>
              <button
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                onClick={() => setIsEvidenceOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="h-[calc(78vh-42px)]">
              <EvidencePanel
                citations={activeCitations}
                artifacts={activeArtifacts}
                pageImages={activePageImages}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
