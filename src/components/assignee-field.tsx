"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

const NEW_VALUE = "__new__";

export function AssigneeField({
  label,
  options,
  defaultValue,
  error,
  addNewLabel,
  backLabel,
}: {
  label: string;
  options: string[];
  defaultValue?: string;
  error?: string[];
  addNewLabel: string;
  backLabel: string;
}) {
  const knownDefault = defaultValue && options.includes(defaultValue) ? defaultValue : undefined;
  const customDefault = defaultValue && !options.includes(defaultValue) ? defaultValue : "";
  const [isCustom, setIsCustom] = React.useState(!!customDefault || options.length === 0);

  return (
    <div className="space-y-1.5">
      <label htmlFor="assigneeName" className="text-sm font-medium">
        {label}
        <span className="text-destructive"> *</span>
      </label>

      {isCustom ? (
        <div className="flex items-center gap-2">
          <input
            id="assigneeName"
            name="assigneeName"
            type="text"
            autoFocus={options.length > 0}
            defaultValue={customDefault}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          {options.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCustom(false)}
              aria-label={backLabel}
              className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <select
          id="assigneeName"
          name="assigneeName"
          defaultValue={knownDefault ?? options[0]}
          onChange={(e) => {
            if (e.target.value === NEW_VALUE) setIsCustom(true);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        >
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={NEW_VALUE}>+ {addNewLabel}</option>
        </select>
      )}

      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
