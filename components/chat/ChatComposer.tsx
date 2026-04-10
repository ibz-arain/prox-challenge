"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowUp, ImagePlus, Mic, Square } from "lucide-react";
import {
  CHAT_GUTTER_X_CLASS,
  CHAT_MAX_WIDTH_CLASS,
  CHAT_PAGE_MAX_WIDTH_CLASS,
} from "@/lib/chatLayout";

/**
 * Thread: bottom fade + composer aligned to the chat column (not the viewport).
 * Uses `absolute` inside `ChatPanel`’s `relative` shell so width matches `max-w-6xl` + flex row layout.
 */
export function ComposerDock({
  children = null,
  className = "",
  innerRef,
  /** When true, skip width/padding transitions so FLIP transform is the only motion. */
  muteLayoutTransition = false,
}: {
  children?: ReactNode;
  className?: string;
  innerRef?: Ref<HTMLDivElement>;
  muteLayoutTransition?: boolean;
}) {
  const layoutTw = muteLayoutTransition
    ? "transition-none"
    : "transition-[max-width,padding,margin] duration-300 ease-out";
  const maxWidthTw = muteLayoutTransition
    ? "transition-none"
    : "transition-[max-width] duration-300 ease-out";
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center bg-linear-to-t from-(--color-bg) via-(--color-bg)/92 to-transparent pb-4 pt-20 md:right-2 ${className}`}
    >
      <div
        className={`pointer-events-auto mx-auto w-full ${layoutTw} ${CHAT_PAGE_MAX_WIDTH_CLASS} ${CHAT_GUTTER_X_CLASS}`}
      >
        <div
          ref={innerRef}
          className={`mx-auto w-full ${maxWidthTw} ${CHAT_MAX_WIDTH_CLASS}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export type ChatComposerMode = "landing" | "thread";

/** Minimal typing for the Web Speech API (not always in TS `dom` lib). */
type WebSpeechResult = { isFinal: boolean; 0: { transcript: string } };
type WebSpeechResultList = { length: number; [i: number]: WebSpeechResult };
type WebSpeechRecognitionEvent = { resultIndex: number; results: WebSpeechResultList };
type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

export type ChatComposerProps = {
  mode: ChatComposerMode;
  onSend: (message: string, image?: string, imageMimeType?: string) => void;
  /** Stops an in-flight streamed response (thread mode). */
  onCancel?: () => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  /** Landing resets when key changes (new session). */
  sessionKey?: number;
  /** When `id` changes, replaces the textarea with `text` (e.g. artifact suggestion click). */
  composerFill?: { id: number; text: string } | null;
  className?: string;
};

function getSpeechRecognitionCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: new () => WebSpeechRecognition;
      webkitSpeechRecognition?: new () => WebSpeechRecognition;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ChatComposer = forwardRef<HTMLDivElement, ChatComposerProps>(
  function ChatComposer(
    {
      mode,
      onSend,
      onCancel,
      disabled = false,
      isSending = false,
      placeholder,
      sessionKey = 0,
      composerFill = null,
      className = "",
    },
    ref
  ) {
    const [text, setText] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [imageMimeType, setImageMimeType] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [listening, setListening] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<WebSpeechRecognition | null>(null);
    const prevModeRef = useRef(mode);

    const speechSupported = typeof window !== "undefined" && !!getSpeechRecognitionCtor();

    useEffect(() => {
      if (mode !== "landing") return;
      setText("");
      setImage(null);
      setImageMimeType(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, [sessionKey, mode]);

    /** After landing FLIP, thread mode mounts — clear input so text lives in the bubble, not the bar. */
    useEffect(() => {
      if (prevModeRef.current === "landing" && mode === "thread") {
        setText("");
        setImage(null);
        setImageMimeType(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      prevModeRef.current = mode;
    }, [mode]);

    useEffect(() => {
      if (!composerFill?.id) return;
      setText(composerFill.text);
      queueMicrotask(() => {
        const ta = textAreaRef.current;
        if (!ta) return;
        ta.focus();
        ta.style.height = "auto";
        ta.style.height =
          Math.min(ta.scrollHeight, Math.min(window.innerHeight * 0.4, 200)) + "px";
      });
    }, [composerFill?.id, composerFill?.text]);

    useEffect(() => {
      return () => {
        try {
          recognitionRef.current?.stop();
        } catch {
          /* ignore */
        }
      };
    }, []);

    const applyImageFile = useCallback((file: File) => {
      if (!file.type.startsWith("image/")) return;
      const mime = file.type?.trim() || undefined;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setImagePreview(dataUrl);
        const base64 = dataUrl.split(",")[1];
        setImage(base64);
        const fromDataUrl = dataUrl.match(/^data:([^;,]+)/)?.[1]?.trim();
        setImageMimeType(mime || fromDataUrl || null);
      };
      reader.readAsDataURL(file);
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      applyImageFile(file);
    };

    const submit = useCallback(() => {
      const trimmed = text.trim();
      if (!trimmed && !image) return;
      onSend(
        trimmed || "What is this?",
        image ?? undefined,
        imageMimeType ?? undefined
      );
      /* Landing stays mounted during dock FLIP — keep text/image until unmount so layout is stable. */
      if (mode === "landing") return;
      setText("");
      setImage(null);
      setImageMimeType(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, [text, image, imageMimeType, onSend, mode]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    };

    const toggleListen = () => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor || disabled || isSending) return;

      if (listening) {
        try {
          recognitionRef.current?.stop();
        } catch {
          /* ignore */
        }
        setListening(false);
        return;
      }

      const rec = new Ctor();
      rec.continuous = mode === "thread";
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event: WebSpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res.isFinal) continue;
          const t = res[0].transcript.trim();
          if (!t) continue;
          setText((prev) => {
            const p = prev.trimEnd();
            return p ? `${p} ${t}` : t;
          });
        }
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    };

    const busy = disabled || isSending;

    const hasFilePayload = (dt: DataTransfer) =>
      Array.from(dt.types as readonly string[]).includes("Files");

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
      if (busy || !hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
      if (busy || !hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      setDragOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (busy) return;
      const files = Array.from(e.dataTransfer.files ?? []);
      const firstImage = files.find((f) => f.type.startsWith("image/"));
      if (!firstImage) return;
      applyImageFile(firstImage);
    };

    const canSend = (text.trim().length > 0 || !!image) && !busy;
    const sendLooksReady = isSending || canSend;
    const showStop = isSending && typeof onCancel === "function";

    const defaultPlaceholder =
      mode === "landing"
        ? "Describe what you need help with…"
        : "Message…";

    return (
      <div className={className}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <div
          ref={ref}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full overflow-hidden rounded-2xl border bg-(--color-surface)/90 shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition-[border-color,box-shadow,ring-color] duration-200 ease-out hover:border-brand/50 hover:shadow-[0_0_0_1px_rgba(239,99,0,0.28),0_0_36px_rgba(239,99,0,0.18),0_12px_40px_rgba(0,0,0,0.4)] hover:ring-brand/25 focus-within:border-brand/50 focus-within:shadow-[0_0_0_1px_rgba(239,99,0,0.28),0_0_36px_rgba(239,99,0,0.18),0_12px_40px_rgba(0,0,0,0.4)] focus-within:ring-brand/25 focus-within:hover:border-brand/50 focus-within:hover:shadow-[0_0_0_1px_rgba(239,99,0,0.28),0_0_36px_rgba(239,99,0,0.18),0_12px_40px_rgba(0,0,0,0.4)] focus-within:hover:ring-brand/25 ${
            dragOver && !busy
              ? "border-brand/60 ring-2 ring-brand/35 shadow-[0_0_0_1px_rgba(239,99,0,0.35),0_0_40px_rgba(239,99,0,0.22),0_12px_40px_rgba(0,0,0,0.45)]"
              : "border-white/10 ring-1 ring-white/5"
          }`}
        >
          {imagePreview && (
            <div className="flex items-start gap-2 border-b border-white/6 px-4 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setImageMimeType(null);
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-white/10 hover:text-neutral-300"
                aria-label="Remove image"
              >
                Remove
              </button>
            </div>
          )}

          <div className="px-4 pt-3.5 pb-1">
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder={placeholder ?? defaultPlaceholder}
              rows={2}
              className="max-h-[min(40vh,200px)] min-h-[52px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-neutral-100 placeholder:text-neutral-500 focus:outline-none disabled:opacity-50"
              style={{ height: "auto", overflow: "hidden" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height =
                  Math.min(target.scrollHeight, Math.min(window.innerHeight * 0.4, 200)) + "px";
              }}
              aria-label={mode === "landing" ? "Ask a question" : "Message"}
            />
          </div>

          <div className="flex items-center gap-0.5 border-t border-white/6 px-1.5 py-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:text-white disabled:opacity-40"
              title="Add image"
              aria-label="Add image"
            >
              <ImagePlus className="h-[17px] w-[17px] stroke-[1.5]" />
            </button>
            <div className="min-w-0 flex-1" aria-hidden />
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListen}
                disabled={busy}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
                  listening
                    ? "bg-brand/15 text-brand-hover ring-1 ring-brand/25"
                    : "text-neutral-500 hover:text-white"
                }`}
                title={listening ? "Stop dictation" : "Dictate"}
                aria-label={listening ? "Stop dictation" : "Dictate"}
                aria-pressed={listening}
              >
                <Mic
                  className={`h-[17px] w-[17px] stroke-[1.5] ${listening ? "animate-pulse" : ""}`}
                />
              </button>
            )}
            <button
              type="button"
              onClick={showStop ? onCancel : submit}
              disabled={showStop ? false : !canSend}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed ${
                sendLooksReady
                  ? "bg-brand/72 text-white hover:bg-brand-hover disabled:opacity-100 disabled:hover:bg-brand/72"
                  : "bg-transparent text-neutral-600 disabled:opacity-35"
              }`}
              aria-label={showStop ? "Stop generation" : "Send message"}
            >
              {showStop ? (
                <Square className="h-3.5 w-3.5 fill-current stroke-2" aria-hidden />
              ) : (
                <ArrowUp
                  className={`h-4 w-4 stroke-2 ${
                    sendLooksReady ? "text-white" : "text-neutral-600"
                  }`}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default ChatComposer;
