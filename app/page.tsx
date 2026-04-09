"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import EvidencePanel from "@/components/evidence/EvidencePanel";
import type { ChatMessage, Citation, Artifact, PageImage } from "@/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [activeArtifacts, setActiveArtifacts] = useState<Artifact[]>([]);
  const [activePageImages, setActivePageImages] = useState<PageImage[]>([]);

  const sendMessage = useCallback(
    async (content: string, image?: string) => {
      const userMessage: ChatMessage = { role: "user", content, image };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Request failed");
        }

        const data = await response.json();

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.text,
          citations: data.citations,
          artifacts: data.artifacts,
          pageImages: data.pageImages,
        };

        setMessages([...newMessages, assistantMessage]);
        setActiveCitations(data.citations ?? []);
        setActiveArtifacts(data.artifacts ?? []);
        setActivePageImages(data.pageImages ?? []);
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: `Sorry, I encountered an error: ${errMsg}. Check OPENROUTER_API_KEY or ANTHROPIC_API_KEY in .env, and that manuals exist under files/.`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const handleSamplePrompt = useCallback(
    (prompt: string) => {
      if (!isLoading) {
        sendMessage(prompt);
      }
    },
    [isLoading, sendMessage]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Left Sidebar */}
      <div className="w-72 flex-shrink-0 hidden lg:block">
        <Sidebar onSamplePrompt={handleSamplePrompt} />
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)]">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
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
    </div>
  );
}
