"use client";

import React, { type ReactNode } from "react";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import InlineCitation from "./InlineCitation";
import StatusTrail from "./StatusTrail";
import ArtifactRenderer from "../artifacts/ArtifactRenderer";
import ArtifactContainer from "../artifacts/ArtifactContainer";
import SourceRow, { getSourceCardId } from "../sources/SourceRow";

interface AssistantMessageProps {
  message: ChatMessage;
  isStreaming: boolean;
  statusTrail: string[];
  hasTextStarted: boolean;
  streamComplete: boolean;
  highlightedSourceId?: string | null;
  onHighlightSource: (sourceId: string) => void;
}

function renderTextWithInlineCitations(
  text: string,
  onCitationClick: (pageNumber: number) => void
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\[p\.(\d+)\]|\(page\s+(\d+)\))/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const pageNumber = Number(match[2] ?? match[3]);
    if (Number.isFinite(pageNumber)) {
      nodes.push(
        <InlineCitation
          key={`citation-${match.index}-${pageNumber}`}
          pageNumber={pageNumber}
          onClick={onCitationClick}
        />
      );
    } else {
      nodes.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length ? nodes : [text];
}

function decorateInlineCitations(
  node: ReactNode,
  onCitationClick: (pageNumber: number) => void,
  keyPrefix = "node"
): ReactNode {
  if (typeof node === "string") {
    return renderTextWithInlineCitations(node, onCitationClick).map((item, index) => (
      <React.Fragment key={`${keyPrefix}-${index}`}>{item}</React.Fragment>
    ));
  }
  if (Array.isArray(node)) {
    return node.map((child, index) =>
      decorateInlineCitations(child, onCitationClick, `${keyPrefix}-${index}`)
    );
  }
  if (React.isValidElement<{ children?: ReactNode }>(node) && node.props?.children) {
    return React.cloneElement(node, {
      ...node.props,
      children: decorateInlineCitations(
        node.props.children,
        onCitationClick,
        `${keyPrefix}-child`
      ),
    });
  }
  return node;
}

function getMessageId(message: ChatMessage, fallbackId: string) {
  return message.id ?? fallbackId;
}

export default function AssistantMessage({
  message,
  isStreaming,
  statusTrail,
  hasTextStarted,
  streamComplete,
  highlightedSourceId,
  onHighlightSource,
}: AssistantMessageProps) {
  const messageId = getMessageId(message, "assistant-message");
  const citations = message.citations ?? [];
  const artifacts = message.artifacts ?? [];
  const pageImages = message.pageImages ?? [];

  const onCitationClick = (pageNumber: number) => {
    const target = citations.find((citation) => citation.pageNumber === pageNumber);
    if (!target) return;
    const sourceId = getSourceCardId(messageId, target);
    onHighlightSource(sourceId);
    const targetNode = document.getElementById(sourceId);
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 ring-1 ring-neutral-700">
        <Bot size={16} strokeWidth={2} />
      </div>
      <div className="max-w-[94%] flex-1 sm:max-w-[85%]">
        <div className="space-y-3">
          {(isStreaming || statusTrail.length > 0) && (
            <StatusTrail
              statuses={statusTrail}
              hasTextStarted={hasTextStarted}
              isDone={streamComplete}
            />
          )}
          <div className="prose-chat text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 text-neutral-300">
                    {decorateInlineCitations(children, onCitationClick, "paragraph")}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-neutral-100">{children}</strong>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="my-2 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-sm">
                        <code className="font-mono text-xs text-neutral-200">{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="rounded-lg bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-brand-hover ring-1 ring-neutral-700">
                      {children}
                    </code>
                  );
                },
                ul: ({ children }) => (
                  <ul className="mb-2 list-inside list-disc space-y-1 text-neutral-300">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 list-inside list-decimal space-y-1 text-neutral-300">
                    {children}
                  </ol>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-1 mt-3 text-base font-semibold leading-snug text-neutral-100">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="mb-1 mt-2 text-sm font-semibold leading-snug text-neutral-100">
                    {children}
                  </h4>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-brand pl-3 text-neutral-400">
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

          {artifacts.length > 0 && (
            <div className="space-y-3 border-t border-neutral-800/70 pt-3">
              {artifacts.map((artifact, index) => (
                <ArtifactContainer key={`${artifact.title}-${index}`}>
                  <ArtifactRenderer artifact={artifact} />
                </ArtifactContainer>
              ))}
            </div>
          )}

          <SourceRow
            messageId={messageId}
            citations={citations}
            pageImages={pageImages}
            visible={!isStreaming}
            highlightedSourceId={highlightedSourceId}
          />
        </div>
      </div>
    </div>
  );
}
