"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_GUTTER_X_CLASS,
  CHAT_MAX_WIDTH_CLASS,
} from "@/lib/chatLayout";
import type { ChatMessage, SelectedSource } from "@/lib/types";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  statusTrail: string[];
  hasTextStarted: boolean;
  streamComplete: boolean;
  highlightedSourceId?: string | null;
  onHighlightSource: (sourceId: string) => void;
  selectedSourceId?: string | null;
  onSelectSource: (source: SelectedSource) => void;
  onFillComposer?: (text: string) => void;
  /** Enables entrance motion after first message (landing → thread). */
  enterReady?: boolean;
  /** On mobile, the evidence sheet overlays from the bottom — add extra scroll room. */
  evidenceOpen?: boolean;
}

export default function MessageList({
  messages,
  isLoading,
  statusTrail,
  hasTextStarted,
  streamComplete,
  highlightedSourceId,
  onHighlightSource,
  selectedSourceId,
  onSelectSource,
  onFillComposer,
  enterReady = true,
  evidenceOpen = false,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const streamingAssistantIndex = useMemo(() => {
    if (!isLoading) return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return i;
      }
    }
    return -1;
  }, [isLoading, messages]);

  /** Smooth follow to bottom while streaming or when artifacts grow; respects reduced motion. */
  useLayoutEffect(() => {
    if (!autoScrollEnabled) return;
    const node = scrollRef.current;
    if (!node) return;

    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";

    const runScroll = () => {
      node.scrollTo({ top: node.scrollHeight, behavior });
    };

    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runScroll);
    });
    return () => window.cancelAnimationFrame(id);
  }, [
    messages,
    statusTrail,
    hasTextStarted,
    isLoading,
    autoScrollEnabled,
    reduceMotion,
  ]);

  /** Async layout (e.g. Mermaid diagrams) grows after paint — keep bottom in view when following. */
  useEffect(() => {
    if (!autoScrollEnabled) return;
    const node = scrollRef.current;
    if (!node) return;
    const inner = node.firstElementChild;
    if (!inner) return;
    /** Smooth scroll only while the assistant is still streaming; after that use instant scroll so late diagram layout does not “creep” the viewport upward. */
    const behavior: ScrollBehavior =
      reduceMotion ? "auto" : isLoading ? "smooth" : "auto";
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior,
        });
      });
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [autoScrollEnabled, reduceMotion, messages, isLoading]);

  const assistantTrail = (message: ChatMessage, index: number) => {
    if (message.role !== "assistant") return [];
    const live = isLoading && index === streamingAssistantIndex;
    return live ? statusTrail : (message.thinkingSteps ?? []);
  };

  const assistantStreamComplete = (message: ChatMessage, index: number) => {
    if (message.role !== "assistant") return true;
    const live = isLoading && index === streamingAssistantIndex;
    return live ? streamComplete : true;
  };

  const assistantHasTextStarted = (message: ChatMessage, index: number) => {
    if (message.role !== "assistant") return false;
    const live = isLoading && index === streamingAssistantIndex;
    if (live) return hasTextStarted;
    return (message.thinkingSteps?.length ?? 0) > 0 || !!message.content?.trim();
  };

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
      className={`chat-thread-scroller sleek-scrollbar min-h-0 flex-1 space-y-10 overscroll-contain pt-6 pb-40 ${evidenceOpen ? "max-md:pb-[min(48vh,28rem)]" : ""} ${CHAT_GUTTER_X_CLASS}`}
    >
      <div className={`mx-auto min-w-0 w-full space-y-10 ${CHAT_MAX_WIDTH_CLASS}`}>
        {messages.map((message, index) =>
          message.role === "user" ? (
            <UserMessage
              key={message.id ?? `user-${index}`}
              message={message}
              entrance={index === 0 ? "first-from-bottom" : "none"}
              enterReady={index === 0 ? enterReady : true}
            />
          ) : (
            <AssistantMessage
              key={message.id ?? `assistant-${index}`}
              message={message}
              isStreaming={isLoading && index === streamingAssistantIndex}
              statusTrail={assistantTrail(message, index)}
              hasTextStarted={assistantHasTextStarted(message, index)}
              streamComplete={assistantStreamComplete(message, index)}
              highlightedSourceId={highlightedSourceId}
              onHighlightSource={onHighlightSource}
              selectedSourceId={selectedSourceId}
              onSelectSource={onSelectSource}
              onFillComposer={onFillComposer}
            />
          )
        )}
      </div>
    </div>
  );
}
