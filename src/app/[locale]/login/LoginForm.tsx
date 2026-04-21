"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onPasswordSignIn(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    if (signInError) {
      setError(t("invalidCredentials"));
      return;
    }
    router.replace("/today");
    router.refresh();
  }

  async function onMagicLink() {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/today`,
      },
    });
    setIsLoading(false);
    if (magicError) {
      setError(magicError.message);
      return;
    }
    setInfo(t("checkEmail"));
  }

  return (
    <form onSubmit={onPasswordSignIn} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          {t("password")}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={isLoading}>
          {t("signInWithEmail")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onMagicLink}
          disabled={isLoading || !email}
        >
          {t("magicLink")}
        </Button>
      </div>
    </form>
  );
}
