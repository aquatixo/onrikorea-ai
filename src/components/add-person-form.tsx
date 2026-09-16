"use client";

import * as React from "react";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPerson } from "@/app/work/person-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

// TODO: only show/allow this once there's a real admin role -- no auth yet, so it's
// open to anyone for now (see person-actions.ts).
export function AddPersonForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).work.form;
  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPerson(name);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setName("");
      setIsOpen(false);
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-2 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-3.5" /> {t.addPerson}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-1.5 px-1">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.newPersonPlaceholder}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-1.5">
        <Button type="submit" size="xs" disabled={isPending}>
          {isPending ? t.creating : t.addPerson}
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={() => setIsOpen(false)}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
