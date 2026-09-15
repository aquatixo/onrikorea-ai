"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { USER_NAME_COOKIE } from "@/lib/user/name-cookie";

export function UserNameControl({ name, placeholder }: { name: string; placeholder: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(name);

  function save() {
    const trimmed = value.trim();
    document.cookie = `${USER_NAME_COOKIE}=${encodeURIComponent(trimmed)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder={placeholder}
      className="w-24 rounded-md border border-sidebar-border bg-transparent px-2 py-1 text-xs text-sidebar-foreground outline-none focus:ring-1 focus:ring-ring/50"
    />
  );
}
