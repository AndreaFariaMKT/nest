import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { NestMark } from "@/components/icons/NestMark";
import {
  CalendarIcon,
  ChartIcon,
  ClientsIcon,
  ContentIcon,
  HomeIcon,
  MeetingsIcon,
  PaletteIcon,
  ProjectsIcon,
  TeamIcon,
} from "@/components/icons/NavIcons";

const items = [
  { href: "/today", icon: HomeIcon, key: "today" },
  { href: "/clients", icon: ClientsIcon, key: "clients" },
  { href: "/projects", icon: ProjectsIcon, key: "projects" },
  { href: "/calendar", icon: CalendarIcon, key: "calendar" },
  { href: "/meetings", icon: MeetingsIcon, key: "meetings" },
  { href: "/content-engine", icon: ContentIcon, key: "contentEngine" },
  { href: "/brand-kits", icon: PaletteIcon, key: "brandKits" },
  { href: "/reports", icon: ChartIcon, key: "reports" },
  { href: "/team", icon: TeamIcon, key: "team" },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 px-6">
        <NestMark className="h-6 w-6" />
        <span className="font-display text-xl">{tBrand("name")}</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
