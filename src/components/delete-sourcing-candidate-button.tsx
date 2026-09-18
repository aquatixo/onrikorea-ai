"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSourcingCandidate } from "@/app/(dashboard)/brands/sourcing/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteSourcingCandidateButton({ candidateId, locale }: { candidateId: string; locale: Locale }) {
  const t = getDictionary(locale).sourcing;
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      aria-label={t.deleteButton}
      onClick={() => {
        if (!confirm(t.confirmDeleteCandidate)) return;
        startTransition(async () => {
          await deleteSourcingCandidate(candidateId);
        });
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
