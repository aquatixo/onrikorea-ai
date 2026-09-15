"use client";

import { Globe } from "lucide-react";

export function WebsiteLink({ website }: { website: string }) {
  const href = website.startsWith("http") ? website : `https://${website}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <Globe className="size-3.5" />
      {website.replace(/^https?:\/\//, "")}
    </a>
  );
}
