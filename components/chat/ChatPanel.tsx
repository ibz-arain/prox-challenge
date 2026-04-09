"use client";

import { useRef, useEffect } from "react";
import { Bot, Loader2, Menu, BookOpenText } from "lucide-react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  agentStage: "searching" | "generating" | null;
  canOpenEvidence: boolean;
  onOpenSidebar: () => void;
  onOpenEvidence: () => void;
  onSend: (message: string, image?: string) => void;
}

export default function ChatPanel({
  messages,
  isLoading,
  agentStage,
  canOpenEvidence,
  onOpenSidebar,
  onOpenEvidence,
  onSend,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2 sm:px-4 lg:hidden">
        <button
          onClick={onOpenSidebar}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Menu size={14} />
          Menu
        </button>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          OmniPro 220
        </span>
        <button
          onClick={onOpenEvidence}
          disabled={!canOpenEvidence}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-40"
        >
          <BookOpenText size={14} />
          View Sources
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6 sm:px-6"
      >
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center mb-4">
              <Bot size={28} className="text-[var(--color-accent)]" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              OmniPro 220 Technical Support
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md">
              Ask me anything about your Vulcan OmniPro 220 welder — setup,
              settings, troubleshooting, specifications, or send an image to
              identify parts.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={
              isLoading &&
              msg.role === "assistant" &&
              i === messages.length - 1
            }
          />
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center">
              <Bot size={16} className="text-[var(--color-text-muted)]" />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-md bg-[var(--color-surface)] border border-[var(--color-border)]">
              <Loader2
                size={14}
                className="animate-spin text-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-muted)]">
                {agentStage === "searching"
                  ? "Searching manual..."
                  : "Generating response..."}
              </span>
            </div>
          </div>
        )}
      </div>

      <ChatInput onSend={onSend} disabled={isLoading} />
    </div>
  );
}
