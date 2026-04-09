"use client";

import { useState } from "react";

type AppNavProps = {
  onHome: () => void;
};

export default function AppNav({ onHome }: AppNavProps) {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <button
      type="button"
      onClick={onHome}
      className="absolute top-5 left-5 z-20 flex items-center gap-2 rounded-lg p-1 text-brand transition-colors duration-500 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
      aria-label="Home — reset app"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoOk ? "/web-app-manifest-512x512.png" : "/product.webp"}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-lg object-cover shadow-sm ring-1 ring-neutral-700"
        onError={() => setLogoOk(false)}
      />
      <span className="text-sm font-semibold tracking-[0.15em] uppercase">
        TARA
      </span>
    </button>
  );
}
