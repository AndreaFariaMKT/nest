import { useTranslations } from "next-intl";

import { Pill } from "@/components/ui/Pill";
import { STAGE_TONE, type DesignState, type SocialStage } from "@/lib/social";

/** One stage, coloured the same way on every screen. */
export function StageBadge({ stage }: { stage: SocialStage }) {
  const t = useTranslations("social.stage");
  return (
    <Pill tone={STAGE_TONE[stage]} className="shrink-0 text-[10px]">
      {t(stage)}
    </Pill>
  );
}

export function DesignBadge({ state }: { state: DesignState }) {
  const t = useTranslations("social.designState");
  const tone = state === "signed_off" ? "success" : state === "done" ? "warning" : "muted";
  return (
    <Pill tone={tone} className="shrink-0 text-[10px]">
      {t(state)}
    </Pill>
  );
}
