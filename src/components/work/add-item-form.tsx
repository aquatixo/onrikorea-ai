"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

// Only adds a category (the quick "+" in the Work sidebar, used while in a meeting).
// Adding a *person* moved to /settings/work-assignees (admin-only) -- see that page's
// actions.ts for why: assignee creation needs an admin gate, and this sidebar form
// had none.
export function AddItemForm({ locale, assigneeOptions }: { locale: Locale; assigneeOptions: string[] }) {
  const t = getDictionary(locale).work.form;
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState("");
  // Starts unselected on purpose -- defaulting to assigneeOptions[0] meant submitting
  // without touching the dropdown silently assigned whoever happened to be first.
  const [categoryAssignee, setCategoryAssignee] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setIsOpen(false);
    setCategoryName("");
    setError(null);
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-2 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-3.5" /> {t.addItem}
      </button>
    );
  }

  return (
    <form onSubmit={handleCreateCategory} className="mt-2 space-y-1.5 px-1">
      <input
        autoFocus
        type="text"
        value={categoryName}
        onChange={(e) => setCategoryName(e.target.value)}
        placeholder={t.newCategoryPlaceholder}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50"
      />
      <select
        required
        value={categoryAssignee}
        onChange={(e) => setCategoryAssignee(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50"
      >
        <option value="" disabled>
          {t.choosePlaceholder}
        </option>
        {assigneeOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-1.5">
        <Button type="submit" size="xs" disabled={!categoryName.trim() || !categoryAssignee}>
          {t.continueButton}
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={reset}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
