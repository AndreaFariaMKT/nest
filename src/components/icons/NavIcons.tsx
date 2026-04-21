import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const HomeIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </svg>
);

export const ClientsIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M3 21a6 6 0 0 1 12 0" />
    <path d="M16 3.5a4 4 0 0 1 0 7.75" />
    <path d="M21 21a6 6 0 0 0-4-5.66" />
  </svg>
);

export const ProjectsIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="7" height="16" rx="1.5" />
    <rect x="14" y="4" width="7" height="10" rx="1.5" />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export const MeetingsIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M15 10l5-3v10l-5-3" />
    <rect x="3" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const ContentIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z" />
  </svg>
);

export const PaletteIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-2 2-2h2a4 4 0 0 0 4-4 9 9 0 0 0-9-7.5z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" />
    <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </svg>
);

export const TeamIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3" />
    <circle cx="5" cy="10" r="2.5" />
    <circle cx="19" cy="10" r="2.5" />
    <path d="M2 20a4 4 0 0 1 6-3.5M22 20a4 4 0 0 0-6-3.5M6 21a6 6 0 0 1 12 0" />
  </svg>
);
