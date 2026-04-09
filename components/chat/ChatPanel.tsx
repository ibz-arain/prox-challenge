"use client";

import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  statusTrail: string[];
  hasTextStarted: boolean;
  streamComplete: boolean;
  highlightedSourceId?: string | null;
  pendingPrompt?: string | null;
  onPendingPromptHandled?: () => void;
  onHighlightSource: (sourceId: string) => void;
  onWelcomePrompt: (prompt: string) => void;
  onSend: (message: string, image?: string) => void;
}

export default function ChatPanel({
  messages,
  isLoading,
  statusTrail,
  hasTextStarted,
  streamComplete,
  highlightedSourceId,
  pendingPrompt,
  onPendingPromptHandled,
  onHighlightSource,
  onWelcomePrompt,
  onSend,
}: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        statusTrail={statusTrail}
        hasTextStarted={hasTextStarted}
        streamComplete={streamComplete}
        highlightedSourceId={highlightedSourceId}
        onHighlightSource={onHighlightSource}
        onWelcomePrompt={onWelcomePrompt}
      />
      <ChatInput
        onSend={onSend}
        disabled={isLoading}
        pendingPrompt={pendingPrompt}
        onPendingPromptHandled={onPendingPromptHandled}
      />
    </div>
  );
}
