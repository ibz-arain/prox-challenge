"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot } from "lucide-react";
import ArtifactRenderer from "../artifacts/ArtifactRenderer";
import { dataUrlFromBase64 } from "@/lib/imageMime";
import type { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({
  message,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-brand text-white"
            : "bg-neutral-800 text-neutral-400 ring-1 ring-neutral-700"
        }`}
      >
        {isUser ? (
          <User size={16} strokeWidth={2} />
        ) : (
          <Bot size={16} strokeWidth={2} />
        )}
      </div>

      <div className={`flex-1 max-w-[94%] sm:max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="flex flex-col items-end gap-2 text-left">
            {message.image && (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-800 shadow-sm sm:h-16 sm:w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dataUrlFromBase64(message.image, message.imageMimeType)}
                  alt="Uploaded"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="inline-block max-w-full rounded-xl rounded-tr-md bg-neutral-800 px-4 py-3 text-sm leading-relaxed text-neutral-100 shadow-sm ring-1 ring-neutral-700">
              {message.content}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="prose-chat text-sm leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 text-neutral-300">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-neutral-100">{children}</strong>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    if (isBlock) {
                      return (
                        <pre className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 overflow-x-auto my-2 shadow-sm">
                          <code className="text-xs font-mono text-neutral-200">{children}</code>
                        </pre>
                      );
                    }
                    return (
                      <code className="px-1.5 py-0.5 rounded-lg bg-neutral-800 text-xs font-mono text-brand-hover ring-1 ring-neutral-700">
                        {children}
                      </code>
                    );
                  },
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-2 text-neutral-300">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-2 text-neutral-300">
                      {children}
                    </ol>
                  ),
                  h3: ({ children }) => (
                    <h3 className="font-semibold text-neutral-100 mt-3 mb-1 text-base leading-snug">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="font-semibold text-neutral-100 mt-2 mb-1 text-sm leading-snug">
                      {children}
                    </h4>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-brand pl-3 my-2 text-neutral-400">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex items-center gap-2 text-neutral-500">
                  <span
                    className="h-2 w-2 rounded-full bg-brand animate-pulse-breath"
                    aria-hidden
                  />
                </span>
              )}
            </div>

            {message.artifacts?.map((artifact, i) => (
              <ArtifactRenderer key={i} artifact={artifact} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
