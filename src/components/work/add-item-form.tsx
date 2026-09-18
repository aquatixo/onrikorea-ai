"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPerson } from "@/app/(dashboard)/work/person-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { cn } from "cn";

type Mode = "closed" | "person" | "category";

// TODO: only show/allow this once there's a real admin role -- no auth yet, so it's
// open to anyone for now (see person-actions.ts).
export function AddItemForm({ locale, assigneeOptions }: { locale: Locale; assigneeOptions: string[] }) {
  const t = getDictionary(locale).work.form;
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("closed");
  const [name, setName] = React.useState("");
  const [categoryName, setCategoryName] = React.useState("");
  const [categoryAssignee, setCategoryAssignee] = React.useState(assigneeOptions[0] ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function reset() {
    setMode("closed");
    setName("");
    setCategoryName("");
    setError(null);
  }

  function handleCreatePerson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPerson(name);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      reset();
    });
  }

  function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      setError(t.categoryRequired);
      return;
    }
    if (!categoryAssignee) {
      setError(t.assigneeRequired);
      return;
    }
    // A category only exists once a work item carries it, so "adding" one means
    // creating that first item directly, pre-filled with the assignee and category.
    router.push(`/work/new?assignee=${encodeURIComponent(categoryAssignee)}&category=${encodeURIComponent(trimmed)}`);
  }

  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("person")}
        className="mt-2 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-3.5" /> {t.addItem}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 px-1">
      <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode("person");
            setError(null);
          }}
          className={cn(
            "flex-1 rounded-md px-2 py-1 transition-colors",
            mode === "person" ? "bg-card shadow-sm" : "text-muted-foreground"
          )}
        >
          {t.addPersonTab}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("category");
            setError(null);
          }}
          className={cn(
            "flex-1 rounded-md px-2 py-1 transition-colors",
            mode === "category" ? "bg-card shadow-sm" : "text-muted-foreground"
          )}
        >
          {t.addCategoryTab}
        </button>
      </div>

      {mode === "person" ? (
        <form onSubmit={handleCreatePerson} className="space-y-1.5">
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
            <Button type="button" size="xs" variant="outline" onClick={reset}>
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCreateCategory} className="space-y-1.5">
          <input
            autoFocus
            type="text"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder={t.newCategoryPlaceholder}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50"
          />
          <select
            value={categoryAssignee}
            onChange={(e) => setCategoryAssignee(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50"
          >
            {assigneeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-1.5">
            <Button type="submit" size="xs">
              {t.continueButton}
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={reset}>
              {t.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
