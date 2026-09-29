"use client";

import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type StatusFilter = "ALL" | "REPLIED" | "CONTACTED";

export function CommunicationStatusFilter({ value, locale }: { value: StatusFilter; locale: Locale }) {
  const t = getDictionary(locale).communications;
  const router = useRouter();

  function handleChange(next: string) {
    router.push(next === "ALL" ? "/brands/communications" : `/brands/communications?status=${next}`);
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
