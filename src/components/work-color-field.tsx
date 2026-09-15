"use client";

import * as React from "react";
import { cn } from "cn";
import { WORK_COLOR_PALETTE } from "@/lib/work-status";

export function WorkColorField({
  label,
  noneLabel,
  defaultValue,
}: {
  label: string;
  noneLabel: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = React.useState(defaultValue ?? "");

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input type="hidden" name="color" value={value} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={noneLabel}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground",
            value === "" && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
        >
          ×
        </button>
        {WORK_COLOR_PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => setValue(hex)}
            aria-label={hex}
            style={{ backgroundColor: hex }}
            className={cn(
              "size-6 shrink-0 rounded-full",
              value === hex && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          />
        ))}
      </div>
    </div>
  );
}
