import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-border bg-card px-8">
      <LanguageSwitcher />
    </header>
  );
}
