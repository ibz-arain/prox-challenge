"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";
import WelcomeState from "../WelcomeState";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  statusTrail: string[];
  hasTextStarted: boolean;
  streamComplete: boolean;
  highlightedSourceId?: string | null;
  onHighlightSource: (sourceId: string) => void;
  onWelcomePrompt: (prompt: string) => void;
}

export default function MessageList({
  messages,
  isLoading,
  statusTrail,
  hasTextStarted,
  streamComplete,
  highlightedSourceId,
  onHighlightSource,
  onWelcomePrompt,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const streamingAssistantIndex = useMemo(() => {
    if (!isLoading) return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return i;
      }
    }
    return -1;
  }, [isLoading, messages]);
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);
  const statusTargetIndex =
    statusTrail.length === 0
      ? -1
      : streamingAssistantIndex >= 0
        ? streamingAssistantIndex
        : lastAssistantIndex;

  useEffect(() => {
    if (!autoScrollEnabled || !scrollRef.current) return;
    const node = scrollRef.current;
    node.scrollTop = node.scrollHeight;
  }, [messages, statusTrail, hasTextStarted, isLoading, autoScrollEnabled]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const isAtBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 50;
    setAutoScrollEnabled(isAtBottom);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="sleek-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6"
    >
      {messages.length === 0 ? (
        <WelcomeState onSelectPrompt={onWelcomePrompt} disabled={isLoading} />
      ) : (
        messages.map((message, index) =>
          message.role === "user" ? (
            <UserMessage key={message.id ?? `user-${index}`} message={message} />
          ) : (
            <AssistantMessage
              key={message.id ?? `assistant-${index}`}
              message={message}
              isStreaming={isLoading && index === streamingAssistantIndex}
              statusTrail={index === statusTargetIndex ? statusTrail : []}
              hasTextStarted={index === statusTargetIndex && hasTextStarted}
              streamComplete={index === statusTargetIndex ? streamComplete : true}
              highlightedSourceId={highlightedSourceId}
              onHighlightSource={onHighlightSource}
            />
          )
        )
      )}
    </div>
  );
}
