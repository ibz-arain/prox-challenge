"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { CHAT_MAX_WIDTH_CLASS } from "@/lib/chatLayout";
import MessageList from "./MessageList";
import ChatComposer, { ComposerDock } from "./ChatComposer";
import type { ChatMessage, SelectedSource } from "@/lib/types";

const LANDING_HEADLINE = "What do you need help with?";

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

/** Landing → dock: longer, ease-out so the bar reads as sliding down with the text, not snapping. */
const DOCK_MS = 960;
const DOCK_EASING = "cubic-bezier(0.28, 0.9, 0.32, 1)";
/** Fade landing chrome (heading + try asking) before the composer FLIP so nothing slides over the input. */
const LANDING_CHROME_FADE_MS = 280;

type PendingSend = { text: string; image?: string; imageMimeType?: string };

function TypewriterHeading({
  sessionKey,
  hidden,
  reduceMotion,
  onTypingStart,
}: {
  sessionKey: number;
  hidden: boolean;
  reduceMotion: boolean;
  /** Fires once when typing begins (first char) or when reduced motion shows the headline. */
  onTypingStart?: () => void;
}) {
  const [typedPrompt, setTypedPrompt] = useState("");
  const onStartRef = useRef(onTypingStart);
  onStartRef.current = onTypingStart;

  useEffect(() => {
    if (hidden) return;
    if (reduceMotion) {
      setTypedPrompt(LANDING_HEADLINE);
      queueMicrotask(() => onStartRef.current?.());
      return;
    }

    setTypedPrompt("");
    let cancelled = false;
    let timeoutId: number | undefined;

    const clearTimer = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };

    const run = () => {
      let pos = 0;
      const tick = () => {
        if (cancelled) return;
        pos += 1;
        setTypedPrompt(LANDING_HEADLINE.slice(0, pos));
        if (pos === 1) {
          onStartRef.current?.();
        }
        if (pos >= LANDING_HEADLINE.length) {
          return;
        }
        const delay = 45 + Math.random() * 55;
        timeoutId = window.setTimeout(tick, delay);
      };
      tick();
    };

    timeoutId = window.setTimeout(run, 0);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [sessionKey, hidden, reduceMotion]);

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
  onSend: (message: string, image?: string, imageMimeType?: string) => void;
  onCancel?: () => void;
  /** Load text into the bottom composer (e.g. HTML artifact suggestion click). */
  onFillComposer?: (text: string) => void;
  composerFill?: { id: number; text: string } | null;
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
  onFillComposer,
  composerFill = null,
}: ChatPanelProps) {
  const [docked, setDocked] = useState(false);
  const [dockLocked, setDockLocked] = useState(false);
  const [fadeLandingChrome, setFadeLandingChrome] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [threadEntered, setThreadEntered] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  /** “Try asking” shows once headline typing has started (first character), in sync with input. */
  const [landingTryAskingReady, setLandingTryAskingReady] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const firstRectRef = useRef<DOMRect | null>(null);
  const pendingSendRef = useRef<PendingSend | null>(null);
  const dockDelayTimeoutRef = useRef<number | undefined>(undefined);
  const landingHostRef = useRef<HTMLDivElement>(null);
  const dockHostRef = useRef<HTMLDivElement>(null);

  const showThread = messages.length > 0;
  const showDock = docked || showThread;
  /** True while animating landing → dock (before messages exist). */
  const dockAnimating = docked && !showThread;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setLandingTryAskingReady(false);
  }, [landingSessionKey]);

  const handleHeadlineTypingStart = useCallback(() => {
    setLandingTryAskingReady(true);
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
    if (pending) onSend(pending.text, pending.image, pending.imageMimeType);
  }, [onSend]);

  /** Keep the composer in one DOM host; must run before FLIP measures the docked bar. */
  useLayoutEffect(() => {
    const host = showDock ? dockHostRef.current : landingHostRef.current;
    setPortalHost((prev) => (prev === host ? prev : host));
  }, [showDock, landingSessionKey]);

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

    const fallbackId = window.setTimeout(settle, DOCK_MS + 280);

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
    (raw: string, image?: string, imageMimeType?: string) => {
      const q = raw.trim();
      if ((!q && !image) || isLoading || dockLocked) return;

      if (reduceMotion) {
        onSend(q || "What is this?", image, imageMimeType);
        return;
      }

      const el = barRef.current;
      if (!el) {
        onSend(q || "What is this?", image, imageMimeType);
        return;
      }

      firstRectRef.current = el.getBoundingClientRect();
      pendingSendRef.current = {
        text: q || "What is this?",
        image,
        imageMimeType,
      };
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

  const landingBusy = isLoading || dockLocked;

  const composerEl =
    portalHost &&
    createPortal(
      <ChatComposer
        ref={barRef}
        mode={showThread ? "thread" : "landing"}
        onSend={showThread ? onSend : beginSend}
        onCancel={onCancel}
        disabled={showThread ? isLoading : landingBusy}
        isSending={isLoading}
        sessionKey={landingSessionKey}
        composerFill={composerFill}
      />,
      portalHost
    );

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-(--color-bg)">
      {showThread ? (
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
          onFillComposer={onFillComposer}
          enterReady={threadEntered}
          evidenceOpen={!!selectedSourceId}
        />
      ) : (
        <div className="sleek-scrollbar relative flex h-full min-h-0 flex-1 flex-col justify-center overflow-y-auto overflow-x-hidden bg-(--color-bg)">
          <div className="flex min-h-min flex-col justify-center px-4 py-8 sm:py-10">
            <div
              key={landingSessionKey}
              className={`mx-auto flex w-full flex-col gap-8 sm:gap-10 ${CHAT_MAX_WIDTH_CLASS}`}
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
                  reduceMotion={reduceMotion}
                  onTypingStart={handleHeadlineTypingStart}
                />
              </div>

              {/* Composer with input; “Try asking” appears when headline typing starts (first char). */}
              <div
                className={`flex w-full flex-col gap-8 sm:gap-10 transition-opacity ease-out ${
                  showDock ? "hidden" : ""
                } ${
                  fadeLandingChrome || docked
                    ? "pointer-events-none opacity-0"
                    : "opacity-100"
                }`}
                style={{
                  transitionDuration:
                    fadeLandingChrome || docked
                      ? `${LANDING_CHROME_FADE_MS}ms`
                      : "300ms",
                }}
                aria-hidden={showDock}
              >
                <div
                  ref={landingHostRef}
                  className="relative z-30 min-h-30 w-full shrink-0"
                />
                {landingTryAskingReady && (
                  <div className="w-full min-h-0 overflow-hidden">
                    <SuggestionRows
                      suggestions={LANDING_SUGGESTIONS}
                      disabled={landingBusy}
                      onPick={(query) => beginSend(query)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDock && (
        <ComposerDock
          muteLayoutTransition={dockAnimating}
          innerRef={dockHostRef}
        />
      )}

      {composerEl}
    </div>
  );
}
