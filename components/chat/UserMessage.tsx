"use client";

import { User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

interface UserMessageProps {
  message: ChatMessage;
}

export default function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex flex-row-reverse gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <User size={16} strokeWidth={2} />
      </div>
      <div className="max-w-[94%] flex-1 text-right sm:max-w-[85%]">
        <div className="inline-block text-left">
          {message.image && (
            <div className="mb-2 inline-block overflow-hidden rounded-xl border border-neutral-800 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${message.image}`}
                alt="Uploaded"
                className="max-h-[150px] max-w-[200px] object-cover"
              />
            </div>
          )}
          <div className="rounded-xl rounded-tr-md bg-neutral-800 px-4 py-3 text-sm leading-relaxed text-neutral-100 shadow-sm ring-1 ring-neutral-700">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
}
