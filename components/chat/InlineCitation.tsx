"use client";

interface InlineCitationProps {
  pageNumber: number;
  onClick: (pageNumber: number) => void;
}

export default function InlineCitation({
  pageNumber,
  onClick,
}: InlineCitationProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(pageNumber)}
      className="mx-0.5 inline-flex rounded-full border border-neutral-700 bg-neutral-900/80 px-1.5 py-0.5 text-[11px] font-medium text-neutral-300 transition-colors duration-150 ease-out hover:border-brand/45 hover:text-brand-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-brand/30"
      aria-label={`Open source for page ${pageNumber}`}
    >
      p.{pageNumber}
    </button>
  );
}
