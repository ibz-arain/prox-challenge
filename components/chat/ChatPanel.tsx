"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import {
  CHAT_MAX_WIDTH_CLASS,
  CHAT_PAGE_MAX_WIDTH_CLASS,
} from "@/lib/chatLayout";
import MessageList from "./MessageList";
import ChatComposer, { ComposerDock } from "./ChatComposer";
import type { ChatMessage, SelectedSource } from "@/lib/types";

const TYPEWRITER_PROMPT = "What do you need help with?";

const LANDING_SUGGESTIONS: { id: string; query: string }[] = [
  {
    id: "duty-cycle",
    query:
      "What's the duty cycle for MIG welding at 200A on 240V?",
  },
  {
    id: "porosity",
    query:
      "I'm getting porosity in my flux-cored welds. What should I check?",
  },
  {
    id: "tig-polarity-ground",
    query:
      "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?",
  },
];

const DOCK_MS = 560;
const DOCK_EASING = "cubic-bezier(0.25, 0.82, 0.2, 1)";
/** Fade landing chrome (heading + try asking) before the composer FLIP so nothing slides over the input. */
const LANDING_CHROME_FADE_MS = 220;

type PendingSend = { text: string; image?: string };

function TypewriterHeading({
  sessionKey,
  hidden,
}: {
  sessionKey: number;
  hidden: boolean;
}) {
  const [typedPrompt, setTypedPrompt] = useState("");

  useEffect(() => {
    if (hidden) return;
    setTypedPrompt("");
    let cancelled = false;
    let timeoutId: number | undefined;

    const clearTimer = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };

    timeoutId = window.setTimeout(() => {
      let pos = 0;
      const tick = () => {
        if (cancelled) return;
        pos += 1;
        setTypedPrompt(TYPEWRITER_PROMPT.slice(0, pos));
        if (pos >= TYPEWRITER_PROMPT.length) return;
        const delay = 45 + Math.random() * 55;
        timeoutId = window.setTimeout(tick, delay);
      };
      tick();
    }, 350);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [sessionKey, hidden]);

  const displayPrompt = typedPrompt.length === 0 ? "\u00A0" : typedPrompt;

  return (
    <h1 className="text-center text-xl font-medium leading-snug tracking-tight text-neutral-300 sm:text-3xl">
      {displayPrompt}
    </h1>
  );
}

function SuggestionRows({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: { id: string; query: string }[];
  disabled: boolean;
  onPick: (query: string) => void;
}) {
  return (
    <div className="w-full">
      <p className="mb-3 px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-600">
        Try asking
      </p>
      <div className="border-y border-white/8">
        {suggestions.map((p, i) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p.query)}
            className={`w-full px-4 py-3.5 text-left text-sm leading-relaxed text-neutral-400 transition-colors duration-150 hover:text-neutral-100 focus:outline-none focus-visible:text-neutral-50 disabled:opacity-50 ${
              i > 0 ? "border-t border-white/6" : ""
            }`}
          >
            {p.query}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChatPanelProps {
  landingSessionKey: number;
  messages: ChatMessage[];
  isLoading: boolean;
  statusTrail: string[];
  hasTextStarted: boolean;
  streamComplete: boolean;
  highlightedSourceId?: string | null;
  onHighlightSource: (sourceId: string) => void;
  selectedSourceId?: string | null;
  onSelectSource: (source: SelectedSource) => void;
  onSend: (message: string, image?: string) => void;
  onCancel?: () => void;
}

export default function ChatPanel({
  landingSessionKey,
  messages,
  isLoading,
  statusTrail,
  hasTextStarted,
  streamComplete,
  highlightedSourceId,
  onHighlightSource,
  selectedSourceId,
  onSelectSource,
  onSend,
  onCancel,
}: ChatPanelProps) {
  const [docked, setDocked] = useState(false);
  const [dockLocked, setDockLocked] = useState(false);
  const [fadeLandingChrome, setFadeLandingChrome] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [threadEntered, setThreadEntered] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const firstRectRef = useRef<DOMRect | null>(null);
  const pendingSendRef = useRef<PendingSend | null>(null);
  const dockDelayTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      if (dockDelayTimeoutRef.current !== undefined) {
        window.clearTimeout(dockDelayTimeoutRef.current);
        dockDelayTimeoutRef.current = undefined;
      }
    },
    []
  );

  const prevMessageCountRef = useRef<number | null>(null);
  const threadEntrancePrevLenRef = useRef(0);

  useEffect(() => {
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (prev !== null && prev > 0 && messages.length === 0) {
      if (dockDelayTimeoutRef.current !== undefined) {
        window.clearTimeout(dockDelayTimeoutRef.current);
        dockDelayTimeoutRef.current = undefined;
      }
      setDocked(false);
      setDockLocked(false);
      setFadeLandingChrome(false);
      pendingSendRef.current = null;
      firstRectRef.current = null;
      setThreadEntered(false);
      threadEntrancePrevLenRef.current = 0;
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length === 0) {
      threadEntrancePrevLenRef.current = 0;
      setThreadEntered(false);
      return;
    }

    const prevLen = threadEntrancePrevLenRef.current;
    threadEntrancePrevLenRef.current = messages.length;

    if (prevLen !== 0) {
      setThreadEntered(true);
      return;
    }

    if (reduceMotion) {
      setThreadEntered(true);
      return;
    }

    setThreadEntered(false);
    const id = window.requestAnimationFrame(() => setThreadEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [messages.length, reduceMotion]);

  const finishDock = useCallback(() => {
    const el = barRef.current;
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.willChange = "";
    }
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    firstRectRef.current = null;
    if (pending) onSend(pending.text, pending.image);
  }, [onSend]);

  useLayoutEffect(() => {
    if (!docked || !pendingSendRef.current || !firstRectRef.current) return;

    if (reduceMotion) {
      finishDock();
      return;
    }

    const el = barRef.current;
    if (!el) {
      finishDock();
      return;
    }

    const first = firstRectRef.current;
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;

    el.style.transition = "none";
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    el.style.willChange = "transform";

    let settled = false;

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      settle();
    };

    const settle = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallbackId);
      finishDock();
    };

    const fallbackId = window.setTimeout(settle, DOCK_MS + 180);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (settled || !barRef.current) return;
        barRef.current.style.transition = `transform ${DOCK_MS}ms ${DOCK_EASING}`;
        barRef.current.style.transform = "translate3d(0, 0, 0)";
      });
    });

    el.addEventListener("transitionend", onEnd);

    return () => {
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallbackId);
      if (!settled) {
        el.style.transition = "";
        el.style.transform = "";
        el.style.willChange = "";
        settle();
      }
    };
  }, [docked, finishDock, reduceMotion]);

  const beginSend = useCallback(
    (raw: string, image?: string) => {
      const q = raw.trim();
      if ((!q && !image) || isLoading || dockLocked) return;

      if (reduceMotion) {
        onSend(q || "What is this?", image);
        return;
      }

      const el = barRef.current;
      if (!el) {
        onSend(q || "What is this?", image);
        return;
      }

      firstRectRef.current = el.getBoundingClientRect();
      pendingSendRef.current = { text: q || "What is this?", image };
      setDockLocked(true);
      setFadeLandingChrome(true);
      if (dockDelayTimeoutRef.current !== undefined) {
        window.clearTimeout(dockDelayTimeoutRef.current);
      }
      dockDelayTimeoutRef.current = window.setTimeout(() => {
        dockDelayTimeoutRef.current = undefined;
        setDocked(true);
      }, LANDING_CHROME_FADE_MS);
    },
    [isLoading, dockLocked, reduceMotion, onSend]
  );

  if (messages.length > 0) {
    return (
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-(--color-bg)">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          statusTrail={statusTrail}
          hasTextStarted={hasTextStarted}
          streamComplete={streamComplete}
          highlightedSourceId={highlightedSourceId}
          onHighlightSource={onHighlightSource}
          selectedSourceId={selectedSourceId}
          onSelectSource={onSelectSource}
          enterReady={threadEntered}
          evidenceOpen={!!selectedSourceId}
        />
        <ComposerDock>
          <ChatComposer
            mode="thread"
            onSend={onSend}
            onCancel={onCancel}
            disabled={isLoading}
            isSending={isLoading}
          />
        </ComposerDock>
      </div>
    );
  }

  const landingBusy = isLoading || dockLocked;

  return (
    <div className="sleek-scrollbar relative flex h-full min-h-0 flex-1 flex-col justify-center overflow-y-auto overflow-x-hidden bg-(--color-bg)">
      <div className="flex min-h-min flex-col justify-center px-4 py-8 sm:py-10">
        <div
          className={`mx-auto flex w-full flex-col gap-8 transition-[max-width] duration-300 ease-out sm:gap-10 ${CHAT_MAX_WIDTH_CLASS}`}
        >
          <div
            className={`origin-top transition-opacity ease-out ${
              fadeLandingChrome || docked
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            } ${reduceMotion && docked ? "hidden" : ""}`}
            style={{
              transitionDuration:
                fadeLandingChrome || docked
                  ? `${LANDING_CHROME_FADE_MS}ms`
                  : "300ms",
            }}
          >
            <TypewriterHeading
              sessionKey={landingSessionKey}
              hidden={fadeLandingChrome || docked}
            />
          </div>

          <div
            className={
              docked
                ? "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center bg-linear-to-t from-(--color-bg) via-(--color-bg)/95 to-transparent pb-5 pt-24"
                : "relative z-30 w-full"
            }
          >
            <div
              className={`pointer-events-auto w-full transition-[max-width,padding,margin] duration-300 ease-out ${
                docked ? `mx-auto ${CHAT_PAGE_MAX_WIDTH_CLASS} px-4 sm:px-6` : ""
              }`}
            >
              <div
                className={`w-full ${
                  docked
                    ? `mx-auto ${CHAT_MAX_WIDTH_CLASS} transition-[max-width] duration-300 ease-out`
                    : ""
                }`}
              >
                <ChatComposer
                  ref={barRef}
                  mode="landing"
                  onSend={beginSend}
                  onCancel={onCancel}
                  disabled={landingBusy}
                  isSending={isLoading}
                  sessionKey={landingSessionKey}
                />
              </div>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-[opacity,max-height] ease-out ${
              fadeLandingChrome || docked
                ? "pointer-events-none max-h-0 opacity-0"
                : "max-h-[2000px] opacity-100"
            }`}
            style={{
              transitionDuration:
                fadeLandingChrome && !docked
                  ? `${LANDING_CHROME_FADE_MS}ms`
                  : "300ms",
            }}
          >
            <SuggestionRows
              suggestions={LANDING_SUGGESTIONS}
              disabled={landingBusy}
              onPick={(query) => beginSend(query)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
