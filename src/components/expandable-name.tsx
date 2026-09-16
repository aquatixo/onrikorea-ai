"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "cn";

/** Brand names are the most important thing in a results table -- truncated by default
 * to keep rows compact, but a click expands just this row's name cell (wrapping to
 * multiple lines) so the full name is always reachable without relying on a hover tooltip. */
export function ExpandableName({ name }: { name: string }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        // Stops the click from bubbling up to a clickable row (e.g. the Brands list row,
        // which navigates to the brand's detail page on any click) -- expanding a name
        // should never accidentally trigger navigation.
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
      className="flex w-full items-start gap-1 text-left"
    >
      {expanded ? (
        <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={cn("min-w-0 flex-1", expanded ? "whitespace-normal break-words" : "truncate")}>{name}</span>
    </button>
  );
}
