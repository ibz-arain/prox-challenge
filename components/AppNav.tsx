"use client";

import { useState } from "react";
import { CHAT_SESSION_STORAGE_KEY } from "@/lib/chat-session-key";

type AppNavProps = {
  onHome: () => void;
  evidenceOpen?: boolean;
};

export default function AppNav({ onHome, evidenceOpen = false }: AppNavProps) {
  const [logoOk, setLogoOk] = useState(true);

  const handleRestart = () => {
    try {
      window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <header
      className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-5 transition-[padding-right] duration-300 ease-[cubic-bezier(0.25,0.82,0.2,1)] motion-reduce:transition-none sm:px-6 ${
        evidenceOpen ? "md:pr-134" : ""
      }`}
    >
      <button
        type="button"
        onClick={onHome}
        className="pointer-events-auto group flex items-center gap-3 rounded-lg p-1 text-left transition-colors duration-200 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
        aria-label="Home — reset conversation"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoOk ? "/web-app-manifest-192x192.png" : "/product.webp"}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-md ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]"
          onError={() => setLogoOk(false)}
        />
        <span className="font-(family-name:--font-brand) text-[13px] font-semibold uppercase tracking-[0.42em] text-neutral-100 sm:text-sm">
          OmniPro
        </span>
      </button>

      <button
        type="button"
        onClick={handleRestart}
        className="pointer-events-auto rounded-lg border border-white/12 bg-neutral-950/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-brand/35 hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
      >
        Restart
      </button>
    </header>
  );
}
