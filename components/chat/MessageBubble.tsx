"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot } from "lucide-react";
import ArtifactRenderer from "../artifacts/ArtifactRenderer";
import type { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block text-left">
            {message.image && (
              <div className="mb-2 inline-block rounded-lg overflow-hidden border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${message.image}`}
                  alt="Uploaded"
                  className="max-w-[200px] max-h-[150px] object-cover"
                />
              </div>
            )}
            <div className="px-4 py-2.5 rounded-2xl rounded-tr-md bg-[var(--color-user-bubble)] text-sm leading-relaxed">
              {message.content}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="prose-invert text-sm leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[var(--color-text)]">
                      {children}
                    </strong>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    if (isBlock) {
                      return (
                        <pre className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-x-auto my-2">
                          <code className="text-xs font-mono">{children}</code>
                        </pre>
                      );
                    }
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-xs font-mono text-[var(--color-accent)]">
                        {children}
                      </code>
                    );
                  },
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-2">
                      {children}
                    </ol>
                  ),
                  h3: ({ children }) => (
                    <h3 className="font-semibold text-[var(--color-text)] mt-3 mb-1">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="font-semibold text-[var(--color-text)] mt-2 mb-1 text-sm">
                      {children}
                    </h4>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-[var(--color-accent)] pl-3 my-2 text-[var(--color-text-muted)]">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
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
