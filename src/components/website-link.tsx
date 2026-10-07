"use client";

import { Globe } from "lucide-react";

// Displays just the domain, not the full path/query -- scraped URLs often carry long
// UTM/tracking strings (?utm_source=...&fbclid=...) that would otherwise blow out any
// table column this renders in. The link itself still goes to the full original URL.
function domainOnly(website: string): string {
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

export function WebsiteLink({ website }: { website: string }) {
  const href = website.startsWith("http") ? website : `https://${website}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      // Browsers natively let you drag a link by its text (no custom drag code needed to
      // trigger it) -- mousedown-then-drag-out-of-bounds to "cancel" a click is a common
      // habit, but on a link it instead starts that native drag gesture, and releasing it
      // outside a valid drop target can leave the browser's drag state stuck (page stops
      // responding to clicks until reload). Nothing here is ever meant to be dragged
      // anywhere, so just disable the browser's native drag entirely.
      draggable={false}
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline [-webkit-user-drag:none]"
    >
      <Globe className="size-3.5" />
      {domainOnly(website)}
    </a>
  );
}
