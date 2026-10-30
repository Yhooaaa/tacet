import type { SVGProps } from "react";

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

type P = SVGProps<SVGSVGElement>;

export const ArrowUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 13V3.5M3.5 8 8 3.5 12.5 8" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

export const Copy = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
  </svg>
);

export const Mail = (p: P) => (
  <svg {...base} {...p}>
    <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
    <path d="m2.5 4.5 5.5 4 5.5-4" />
  </svg>
);

export const Phone = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.25" y="1.5" width="7.5" height="13" rx="1.75" />
    <path d="M7 12.25h2" />
  </svg>
);

export const At = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M10.5 8v1a2 2 0 0 0 4 0V8a6.5 6.5 0 1 0-2.6 5.2" />
  </svg>
);

export const External = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V5a.5.5 0 0 1 .5-.5H7" />
  </svg>
);

export const Minus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 8h8" />
  </svg>
);

export const Alert = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v3M8 11h.01" />
    <path d="M7.13 2.5 1.6 12a1 1 0 0 0 .87 1.5h11.06a1 1 0 0 0 .87-1.5L8.87 2.5a1 1 0 0 0-1.74 0Z" />
  </svg>
);

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TacetMark({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" className={className}>
      <circle cx="6" cy="10" r="4.5" />
      <circle cx="13.5" cy="6" r="1.6" opacity="0.75" />
      <circle cx="14" cy="13.5" r="1.3" opacity="0.55" />
      <circle cx="18" cy="9.5" r="1" opacity="0.4" />
    </svg>
  );
}
