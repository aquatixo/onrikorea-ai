"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type StatusFilter = "ALL" | "REPLIED" | "CONTACTED";

export function CommunicationStatusFilter({ value, locale }: { value: StatusFilter; locale: Locale }) {
  const t = getDictionary(locale).communications;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ALL") params.delete("status");
    else params.set("status", next);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
    >
      <option value="ALL">{t.filterAll}</option>
      <option value="REPLIED">{t.filterReplied}</option>
      <option value="CONTACTED">{t.filterContacted}</option>
    </select>
  );
}
