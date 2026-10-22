"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { useClientLocale } from "@/lib/i18n/use-client-locale";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = getDictionary(useClientLocale()).common;
  const [mounted, setMounted] = React.useState(false);

  // Avoid rendering theme-dependent UI until mounted, to prevent hydration mismatch
  // (the server has no way to know the user's stored/system preference).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount flag, see comment above
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden className="opacity-0" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? t.switchToLight : t.switchToDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
