"use client";

import type { ChatMessage } from "@/lib/types";

interface UserMessageProps {
  message: ChatMessage;
}

export default function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(100%,36rem)] text-right">
        {message.image && (
          <div className="mb-2 inline-block overflow-hidden rounded-xl border border-white/[0.1] shadow-sm ring-1 ring-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${message.image}`}
              alt=""
              className="max-h-[160px] max-w-[240px] object-cover"
            />
          </div>
        )}
        <div className="inline-block rounded-2xl border border-white/[0.1] bg-[var(--color-user-bubble)] px-4 py-2.5 text-left text-[15px] leading-relaxed text-neutral-100 shadow-sm ring-1 ring-white/[0.04]">
          {message.content}
        </div>
      </div>
    </div>
  );
}
