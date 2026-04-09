"use client";

import { useEffect, useState, useRef, type KeyboardEvent } from "react";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, image?: string) => void;
  disabled?: boolean;
  pendingPrompt?: string | null;
  onPendingPromptHandled?: () => void;
}

export default function ChatInput({
  onSend,
  disabled,
  pendingPrompt,
  onPendingPromptHandled,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    onSend(trimmed || "What is this?", image ?? undefined);
    setText("");
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!pendingPrompt || disabled) return;
    setText(pendingPrompt);
    onSend(pendingPrompt);
    setText("");
    onPendingPromptHandled?.();
  }, [pendingPrompt, disabled, onSend, onPendingPromptHandled]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-neutral-800 bg-black/50 px-4 py-4">
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Upload preview"
            className="h-16 rounded-xl border border-neutral-800 shadow-sm"
          />
          <button
            type="button"
            onClick={() => {
              setImage(null);
              setImagePreview(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm transition-colors duration-500 ease-out hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            aria-label="Remove image"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 p-3 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-500 shadow-sm transition-colors duration-500 ease-out hover:border-brand/35 hover:text-neutral-200 hover:bg-brand/10 focus:outline-none focus-visible:border-brand/45 focus-visible:ring-1 focus-visible:ring-brand/25 disabled:opacity-60"
          title="Upload an image"
        >
          <ImagePlus size={18} strokeWidth={2} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <div className="flex-1 min-w-0 focus-within:shadow-md rounded-xl transition-shadow duration-500 ease-out focus-within:ring-1 focus-within:ring-brand/20">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about the OmniPro 220..."
            rows={1}
            className="w-full min-h-[48px] max-h-[120px] resize-none rounded-xl border border-neutral-700/80 bg-neutral-900/80 px-4 py-3 text-base text-neutral-100 placeholder:text-neutral-500 transition-colors duration-500 ease-out focus:bg-neutral-900 focus:border-neutral-600 focus:outline-none focus:ring-0 disabled:opacity-60 leading-relaxed"
            style={{
              height: "auto",
              overflow: "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !image)}
          className="flex-shrink-0 p-3 rounded-xl bg-neutral-950 text-white shadow-sm ring-1 ring-neutral-800 transition-colors duration-500 ease-out hover:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40"
          aria-label={disabled ? "Sending" : "Send message"}
        >
          {disabled ? (
            <Loader2 size={18} className="animate-spin" strokeWidth={2} />
          ) : (
            <Send size={18} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
