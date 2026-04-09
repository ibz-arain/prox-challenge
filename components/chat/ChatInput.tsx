"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, image?: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Upload preview"
            className="h-16 rounded-lg border border-[var(--color-border)]"
          />
          <button
            onClick={() => {
              setImage(null);
              setImagePreview(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 p-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
          title="Upload an image"
        >
          <ImagePlus size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <div className="flex-1 relative">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about the OmniPro 220..."
            rows={1}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 min-h-[42px] max-h-[120px]"
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
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !image)}
          className="flex-shrink-0 p-2.5 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:hover:bg-[var(--color-accent)]"
        >
          {disabled ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
