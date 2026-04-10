"use client";

import { dataUrlFromBase64 } from "@/lib/imageMime";
import type { ChatMessage } from "@/lib/types";

interface UserMessageProps {
  message: ChatMessage;
  /** First bubble after landing: slides up with the thread instead of snapping. */
  entrance?: "none" | "first-from-bottom";
  /** When `entrance` is first-from-bottom, waits for thread entrance so motion is visible. */
  enterReady?: boolean;
}

export default function UserMessage({
  message,
  entrance = "none",
  enterReady = true,
}: UserMessageProps) {
  const firstEntrance =
    entrance === "first-from-bottom"
      ? `transition-[transform,opacity] duration-[720ms] ease-[cubic-bezier(0.25,0.82,0.2,1)] motion-reduce:transition-none ${
          enterReady
            ? "translate-y-0 opacity-100"
            : "translate-y-12 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"
        }`
      : "";

  return (
    <div className={`flex justify-end ${firstEntrance}`}>
      <div className="flex max-w-[min(100%,36rem)] flex-col items-end gap-2 text-right">
        {message.image && (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-sm ring-1 ring-white/5 sm:h-16 sm:w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrlFromBase64(message.image, message.imageMimeType)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="inline-block max-w-full rounded-2xl border border-white/10 bg-(--color-user-bubble) px-4 py-2.5 text-left text-[15px] leading-relaxed text-neutral-100 shadow-sm ring-1 ring-white/5">
          {message.content}
        </div>
      </div>
    </div>
  );
}
