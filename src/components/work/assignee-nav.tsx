"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { AddItemForm } from "@/components/work/add-item-form";
import { reassignCategory } from "@/app/(dashboard)/work/category-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { cn } from "cn";

type AssigneeEntry = { name: string; isEtc: boolean };

function assigneeHref(name: string, category: string, pageSize: number) {
  const params = new URLSearchParams();
  if (name) params.set("assignee", name);
  if (category) params.set("category", category);
  params.set("pageSize", String(pageSize));
  return `/work?${params.toString()}`;
}

export function WorkAssigneeNav({
  locale,
  assignees,
  categoriesByAssignee,
  currentAssignee,
  currentCategory,
  pageSize,
  addItemOptions,
}: {
  locale: Locale;
  assignees: AssigneeEntry[];
  categoriesByAssignee: Record<string, string[]>;
  currentAssignee: string;
  currentCategory: string;
  pageSize: number;
  addItemOptions: string[];
}) {
  const t = getDictionary(locale).work;
  const router = useRouter();
  const [dragOverAssignee, setDragOverAssignee] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  // Everything used to render permanently expanded, which got overwhelming once every
  // assignee had a full category list -- collapsed by default, expanded on demand, except
  // the assignee currently being viewed defaults open so its own filter is visible. That
  // default is only a default though: clicking the chevron on the active assignee must still
  // be able to collapse it, so an explicit click is tracked separately and always wins over
  // the "currentAssignee" default, in either direction.
  const [overrides, setOverrides] = React.useState<Map<string, boolean>>(() => new Map());

  function toggleExpanded(name: string, currentlyOpen: boolean) {
    setOverrides((prev) => new Map(prev).set(name, !currentlyOpen));
  }

  function handleDrop(e: React.DragEvent, toAssignee: string) {
    e.preventDefault();
    setDragOverAssignee(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;

    let payload: { fromAssignee?: string; category?: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const { fromAssignee, category } = payload;
    if (!fromAssignee || !category || fromAssignee === toAssignee) return;

    setError(null);
    startTransition(async () => {
      const result = await reassignCategory(fromAssignee, category, toAssignee);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <nav className="shrink-0 space-y-0.5 rounded-2xl border border-border bg-card p-2 shadow-sm sm:w-52">
      <Link
        href={assigneeHref("", "", pageSize)}
        className={cn(
          "block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          !currentAssignee ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        )}
      >
        {t.allAssignees}
      </Link>

      {assignees.map(({ name, isEtc }) => {
        const categories = categoriesByAssignee[name] ?? [];
        const isActive = currentAssignee === name && !currentCategory;
        const isDragOver = dragOverAssignee === name;
        const isOpen = overrides.get(name) ?? currentAssignee === name;

        return (
          <div key={name}>
            <div className="flex items-center gap-0.5">
              <Link
                href={assigneeHref(name, "", pageSize)}
                onClick={() => {
                  if (categories.length > 0) toggleExpanded(name, isOpen);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverAssignee(name);
                }}
                onDragLeave={() => setDragOverAssignee((current) => (current === name ? null : current))}
                onDrop={(e) => handleDrop(e, name)}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  isDragOver && !isActive && "bg-muted ring-2 ring-inset ring-primary/50"
                )}
              >
                <UserAvatar name={name} size="sm" />
                {isEtc ? t.etcLabel : name}
              </Link>
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(name, isOpen)}
                  aria-label={isOpen ? t.form.collapse : t.form.expand}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                </button>
              )}
            </div>

            {categories.length > 0 && isOpen && (
              <div className="ml-3.5 flex flex-col gap-0.5 border-l border-border pl-3">
                {categories.map((cat) => (
                  <Link
                    key={cat}
                    href={assigneeHref(name, cat, pageSize)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ fromAssignee: name, category: cat })
                      );
                    }}
                    className={cn(
                      "cursor-grab rounded-lg px-2.5 py-1 text-xs font-medium transition-colors active:cursor-grabbing",
                      currentAssignee === name && currentCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="px-2 pt-1 text-xs text-destructive">{error}</p>}

      <div className="pt-1">
        <AddItemForm locale={locale} assigneeOptions={addItemOptions} />
      </div>
    </nav>
  );
}
