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

export const ServicesIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3l8 4v5c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7z" />
    <path d="M9 11l2 2 4-4" />
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

export const SettingsIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const MessageIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 5h16v11H8l-4 4z" />
  </svg>
);

export const CoinIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8M14 9.5h-3a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H10" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
    <path d="M5 18h13" />
  </svg>
);

export const FolderIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const FunnelIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 5h16l-6 7v6l-4 2v-8z" />
  </svg>
);

export const MegaphoneIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 11v2l13 5V6z" />
    <path d="M16 9a3 3 0 0 1 0 6" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const PlaybookIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

export const LayersIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const PenIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 20l4-1 10-10-3-3L5 16z" />
    <path d="M14 6l3 3" />
  </svg>
);

export const CodeIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </svg>
);

export const FileIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4" />
  </svg>
);
