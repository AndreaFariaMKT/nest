import {
  HomeIcon,
  ProjectsIcon,
  CalendarIcon,
  ClientsIcon,
  TeamIcon,
  MeetingsIcon,
  ContentIcon,
  MessageIcon,
  CoinIcon,
  BookIcon,
  FolderIcon,
  FunnelIcon,
  MegaphoneIcon,
  ClockIcon,
  EyeIcon,
  PlaybookIcon,
  LayersIcon,
  PenIcon,
  CodeIcon,
  FileIcon,
  BellIcon,
  ChartIcon,
  FilmIcon,
  KeyIcon,
} from "@/components/icons/NavIcons";

/**
 * The 8 roles from the AFM prototype. Each login has one role (per tenant
 * membership) which determines the whole app view — the sidebar menu and which
 * pages are reachable. Founders can preview any role via "View as".
 */
export const APP_ROLES = [
  "founder",
  "manager",
  "social",
  "designer_social",
  "designer_identity",
  "developer",
  "accountant",
  "client",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABEL: Record<AppRole, string> = {
  founder: "Founder",
  manager: "Manager",
  social: "Social media",
  designer_social: "Designer · social",
  designer_identity: "Designer · identity",
  developer: "Developer",
  accountant: "Accountant",
  client: "Client",
};

export function isAppRole(v: string | undefined | null): v is AppRole {
  return !!v && (APP_ROLES as readonly string[]).includes(v);
}

/** Every navigable destination in the app. `label` is an i18n key under nav.*. */
export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: typeof HomeIcon;
}

export const NAV: Record<string, NavItem> = {
  home: { key: "home", href: "/today", label: "home", icon: HomeIcon },
  tasks: { key: "tasks", href: "/projects", label: "tasks", icon: ProjectsIcon },
  calendar: { key: "calendar", href: "/calendar", label: "calendar", icon: CalendarIcon },
  messages: { key: "messages", href: "/messages", label: "messages", icon: MessageIcon },
  bplan: { key: "bplan", href: "/business-plan", label: "businessPlan", icon: BookIcon },
  admin: { key: "admin", href: "/administration", label: "administration", icon: FolderIcon },
  finance: { key: "finance", href: "/finance", label: "finance", icon: CoinIcon },
  commercial: { key: "commercial", href: "/commercial", label: "commercial", icon: FunnelIcon },
  marketing: { key: "marketing", href: "/marketing", label: "marketing", icon: MegaphoneIcon },
  content: { key: "content", href: "/content-calendar", label: "contentCalendar", icon: ContentIcon },
  schedule: { key: "schedule", href: "/scheduling", label: "scheduling", icon: ClockIcon },
  overview: { key: "overview", href: "/overview", label: "overview", icon: EyeIcon },
  clients: { key: "clients", href: "/clients", label: "clients", icon: ClientsIcon },
  people: { key: "people", href: "/team", label: "people", icon: TeamIcon },
  playbook: { key: "playbook", href: "/playbook", label: "playbook", icon: PlaybookIcon },
  queue: { key: "queue", href: "/production-queue", label: "productionQueue", icon: LayersIcon },
  social: { key: "social", href: "/social", label: "socialMedia", icon: MegaphoneIcon },
  reports: { key: "reports", href: "/reports", label: "reports", icon: ChartIcon },
  feedback: { key: "feedback", href: "/feedback", label: "feedback", icon: MeetingsIcon },
  idprojects: { key: "idprojects", href: "/identity-projects", label: "identityProjects", icon: PenIcon },
  builds: { key: "builds", href: "/website-builds", label: "websiteBuilds", icon: CodeIcon },
  // Client portal
  c_waiting: { key: "c_waiting", href: "/portal/waiting", label: "waitingOnYou", icon: BellIcon },
  c_overview: { key: "c_overview", href: "/portal", label: "projectOverview", icon: EyeIcon },
  c_content: { key: "c_content", href: "/portal/content", label: "content", icon: ContentIcon },
  c_calendar: { key: "c_calendar", href: "/portal/calendar", label: "calendar", icon: CalendarIcon },
  c_meetings: { key: "c_meetings", href: "/portal/meetings", label: "meetings", icon: MeetingsIcon },
  c_messages: { key: "c_messages", href: "/portal/messages", label: "chat", icon: MessageIcon },
  c_invoices: { key: "c_invoices", href: "/portal/invoices", label: "invoices", icon: FileIcon },
  c_media: { key: "c_media", href: "/portal/media", label: "mediaLibrary", icon: FilmIcon },
  c_logins: { key: "c_logins", href: "/portal/logins", label: "sharedLogins", icon: KeyIcon },
  c_report: { key: "c_report", href: "/portal/report", label: "performance", icon: ChartIcon },
};

export interface NavGroup {
  group: string; // i18n key under nav.groups.*
  keys: string[];
}

/** Role → grouped menu, mirroring the prototype's per-persona navigation. */
export const NAV_BY_ROLE: Record<AppRole, NavGroup[]> = {
  founder: [
    { group: "daily", keys: ["home", "tasks", "calendar", "messages"] },
    { group: "leadership", keys: ["bplan", "admin", "finance", "commercial", "marketing"] },
    { group: "content", keys: ["social", "content", "schedule"] },
    { group: "insights", keys: ["reports"] },
    { group: "operation", keys: ["overview", "clients"] },
    { group: "directory", keys: ["people", "playbook"] },
  ],
  manager: [
    { group: "daily", keys: ["home", "tasks", "calendar", "messages"] },
    { group: "marketing", keys: ["marketing", "social", "content", "schedule"] },
    { group: "insights", keys: ["reports"] },
    { group: "operation", keys: ["overview", "clients"] },
    { group: "directory", keys: ["people", "playbook"] },
  ],
  social: [
    { group: "daily", keys: ["home", "tasks", "messages"] },
    { group: "content", keys: ["social", "content", "schedule", "marketing"] },
    { group: "directory", keys: ["playbook"] },
  ],
  designer_social: [
    { group: "daily", keys: ["home", "calendar", "messages"] },
    { group: "work", keys: ["social", "queue", "feedback"] },
    { group: "directory", keys: ["playbook"] },
  ],
  designer_identity: [
    { group: "daily", keys: ["home", "messages"] },
    { group: "work", keys: ["idprojects"] },
    { group: "directory", keys: ["playbook"] },
  ],
  developer: [
    { group: "daily", keys: ["home", "messages"] },
    { group: "work", keys: ["builds"] },
    { group: "directory", keys: ["playbook"] },
  ],
  accountant: [
    { group: "daily", keys: ["home", "messages"] },
    { group: "finance", keys: ["finance", "admin"] },
  ],
  client: [
    {
      group: "portal",
      keys: [
        "c_waiting",
        "c_overview",
        "c_content",
        "c_calendar",
        "c_report",
        "c_meetings",
        "c_media",
        "c_logins",
        "c_messages",
        "c_invoices",
      ],
    },
  ],
};

/** Flat set of hrefs a role may reach (for guards). */
export function allowedHrefsForRole(role: AppRole): Set<string> {
  const hrefs = new Set<string>();
  for (const g of NAV_BY_ROLE[role]) {
    for (const k of g.keys) hrefs.add(NAV[k].href);
  }
  return hrefs;
}
