// @edufarm/ui icons — inline SVG set (no emoji anywhere in the product).
// Stroke style, currentColor, 24×24 viewBox. Usage: <Icon name="book" size={16} />
import React from "react";

export type IconName =
  | "dashboard" | "book" | "quiz" | "library" | "qa" | "ai" | "verify" | "upload"
  | "earnings" | "insights" | "announce" | "dispute" | "mail" | "school" | "home"
  | "star" | "chart" | "bell" | "search" | "settings" | "clock" | "calendar"
  | "check" | "checkBadge" | "x" | "plus" | "trash" | "chevR" | "chevL" | "arrowR"
  | "user" | "shield" | "wallet" | "lock" | "bulb" | "grad" | "dot" | "file";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  book: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>),
  quiz: (<><path d="M9 11l3 3 8-8" /><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" /></>),
  library: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /><path d="M9 8h7" /></>),
  qa: (<><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /><path d="M9 12h6M12 9v6" /></>),
  ai: (<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" /></>),
  verify: (<><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  upload: (<><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  earnings: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c-.7-1-2-1.5-3-1.5-1.7 0-3 .9-3 2.5s1.3 2.3 3 2.5c1 .1 2.3.4 2.3 2s-1.3 2.5-3 2.5c-1 0-2.3-.5-3-1.5" /></>),
  insights: (<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  announce: (<><path d="M3 11l18-7-7 18-2.5-7.5L3 11z" /></>),
  dispute: (<><path d="M12 3v18M5 7l14 10M19 7L5 17" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  school: (<><path d="M3 10l9-6 9 6" /><path d="M5 8v8m4-8v8m4-8v8m4-8v8M3 20h18M9 20v-4h6v4" /></>),
  home: (<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>),
  star: (<><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1L3.2 9.5l6.1-.9L12 3z" /></>),
  chart: (<><path d="M4 20V10m6 10V4m6 16v-7" /><path d="M2 20h20" /></>),
  bell: (<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></>),
  check: (<><path d="M4 12.5l5 5L20 6.5" /></>),
  checkBadge: (<><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  x: (<><path d="M6 6l12 12M18 6L6 18" /></>),
  plus: (<><path d="M12 5v14M5 12h14" /></>),
  trash: (<><path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13" /></>),
  chevR: (<><path d="M9 6l6 6-6 6" /></>),
  chevL: (<><path d="M15 6l-6 6 6 6" /></>),
  arrowR: (<><path d="M4 12h16m-6-6l6 6-6 6" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>),
  shield: (<><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" /></>),
  wallet: (<><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path d="M16 13h.01M3 9h18" /></>),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  bulb: (<><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z" /></>),
  grad: (<><path d="M2 9l10-5 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" /><path d="M22 9v5" /></>),
  dot: (<><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" /></>),
  file: (<><path d="M6 2h8l4 4v16H6V2z" /><path d="M14 2v4h4" /></>),
};

export function Icon({ name, size = 16, className, style }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "inline-block", verticalAlign: "-3px", flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// Text-free status dot (replaces the ● character)
export function Dot({ color = "currentColor", size = 8 }: { color?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-block", width: size, height: size, borderRadius: 99, background: color, verticalAlign: "baseline" }}
    />
  );
}
