"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteUser } from "@/app/(dashboard)/settings/users/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteUserButton({ userId, locale }: { userId: string; locale: Locale }) {
  const t = getDictionary(locale).settings.users;
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      aria-label={t.deleteButton}
      onClick={() => {
        if (!confirm(t.confirmDelete)) return;
        startTransition(async () => {
          const result = await deleteUser(userId);
          if (result?.error) alert(result.error);
        });
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
