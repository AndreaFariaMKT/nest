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
  FolderIcon,
  FunnelIcon,
  MegaphoneIcon,
  ClockIcon,
  EyeIcon,
  PenIcon,
  CodeIcon,
  FileIcon,
  BellIcon,
  ChartIcon,
  FilmIcon,
  KeyIcon,
  ServicesIcon,
  SettingsIcon,
} from "@/components/icons/NavIcons";

/**
 * The 8 roles from the AFM prototype. Each login has one role (per tenant
 * membership) which determines the whole app view — the sidebar menu and which
 * pages are reachable. Founders can preview any role via "View as".
 *
 * The vocabulary itself lives in app-roles.ts, which imports nothing: this
 * file pulls in React icon components, so it cannot be reached from Edge
 * middleware or a unit test. Re-exported here so existing imports keep working.
 */
export {
  APP_ROLES,
  isAppRole,
  mapStoredRole,
  type AppRole,
} from "@/lib/app-roles";
import type { AppRole } from "@/lib/app-roles";

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
  admin: { key: "admin", href: "/administration", label: "administration", icon: FolderIcon },
  // Founder only, and the nav is the cosmetic half — /admin is in guard.ts's
  // RESTRICTED and the page redirects on its own.
  errors: { key: "errors", href: "/admin/errors", label: "errors", icon: FolderIcon },
  // Both existed as routes with no way in. /meetings was reachable only
  // through the social module's screen list, so a designer could open a
  // meeting from the calendar but never see the list; /settings holds the
  // only "connect Google Calendar" button in the app and was reachable only
  // as the OAuth callback's landing page — you could not get there without
  // having already connected.
  meetings: { key: "meetings", href: "/meetings", label: "meetings", icon: MeetingsIcon },
  settings: { key: "settings", href: "/settings", label: "settings", icon: SettingsIcon },
  finance: { key: "finance", href: "/finance", label: "finance", icon: CoinIcon },
  commercial: { key: "commercial", href: "/commercial", label: "commercial", icon: FunnelIcon },
  marketing: { key: "marketing", href: "/marketing", label: "marketing", icon: MegaphoneIcon },
  // The content engine's own board. /production-queue pointed at the same
  // table with a narrower status filter — literally this screen's first
  // bucket — and the same editor, so it was one door too many.
  content: { key: "content", href: "/content-calendar", label: "contentCalendar", icon: ContentIcon },
  // The module's monthly report, beside the other reports rather than inside
  // the fortnight's navigation: it is a monthly artifact, not a daily screen.
  socialReport: { key: "socialReport", href: "/social/report", label: "performance", icon: ChartIcon },
  // The service catalogue. ClientServicesCard assigns services to clients and
  // never linked to the place they are created, so the only way in was typing
  // the URL.
  services: { key: "services", href: "/services", label: "services", icon: ServicesIcon },
  schedule: { key: "schedule", href: "/scheduling", label: "scheduling", icon: ClockIcon },
  overview: { key: "overview", href: "/overview", label: "overview", icon: EyeIcon },
  clients: { key: "clients", href: "/clients", label: "clients", icon: ClientsIcon },
  people: { key: "people", href: "/team", label: "people", icon: TeamIcon },
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
    { group: "daily", keys: ["home", "tasks", "calendar", "meetings", "messages"] },
    { group: "leadership", keys: ["admin", "finance", "commercial", "marketing"] },
    { group: "content", keys: ["social", "content", "schedule"] },
    { group: "insights", keys: ["reports", "socialReport"] },
    { group: "operation", keys: ["overview", "clients"] },
    { group: "directory", keys: ["people", "services"] },
    { group: "system", keys: ["errors", "settings"] },
  ],
  manager: [
    { group: "daily", keys: ["home", "tasks", "calendar", "meetings", "messages"] },
    { group: "marketing", keys: ["marketing", "social", "content", "schedule"] },
    { group: "insights", keys: ["reports", "socialReport"] },
    { group: "operation", keys: ["overview", "clients"] },
    { group: "directory", keys: ["people"] },
  ],
  social: [
    { group: "daily", keys: ["home", "tasks", "messages"] },
    { group: "content", keys: ["social", "content", "marketing"] },
    { group: "insights", keys: ["socialReport"] },
  ],
  designer_social: [
    { group: "daily", keys: ["home", "calendar", "messages"] },
    // No "queue" here any more: it pointed at the content engine's board,
    // while a social designer's actual queue is inside the module.
    { group: "work", keys: ["social", "feedback"] },
  ],
  designer_identity: [
    { group: "daily", keys: ["home", "messages"] },
    { group: "work", keys: ["idprojects"] },
  ],
  developer: [
    { group: "daily", keys: ["home", "messages"] },
    { group: "work", keys: ["builds"] },
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

// allowedHrefsForRole() lived here: a second, unused permission mechanism
// built for a guard job that guard.ts does instead. A dead access-control
// helper is worse than no helper — the next person to find it reasonably
// assumes it is what protects the app.
