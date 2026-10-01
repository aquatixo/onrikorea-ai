"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { renamePerson, deletePerson } from "@/app/(dashboard)/settings/work-assignees/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function PersonRow({
  id,
  name,
  assignedCount,
  locale,
}: {
  id: string;
  name: string;
  assignedCount: number;
  locale: Locale;
}) {
  const t = getDictionary(locale).settings.people;
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(name);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function cancelEdit() {
    setIsEditing(false);
    setDraftName(name);
    setError(null);
  }

  function handleRename() {
    setError(null);
    startTransition(async () => {
      const result = await renamePerson(id, draftName);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!(await confirm({ description: t.confirmDelete, destructive: true }))) return;
    startTransition(async () => {
      const result = await deletePerson(id);
      if (result?.error) {
        await confirm({ description: result.error, alertOnly: true });
        return;
      }
      router.refresh();
    });
  }

  return (
    <TableRow>
      {confirmDialog}
      <TableCell className="font-medium">
        {isEditing ? (
          <div className="space-y-1">
            <input
              autoFocus
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          name
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{assignedCount}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending || !draftName.trim()}
                aria-label={t.saveButton}
                onClick={handleRename}
              >
                <Check className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t.cancelButton} onClick={cancelEdit}>
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.renameButton}
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                aria-label={t.deleteButton}
                onClick={handleDelete}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
