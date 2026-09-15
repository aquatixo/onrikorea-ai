"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export function PageSizeControl({ value, label }: { value: number; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", next);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
