"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { addSourcingCandidateToBrands } from "@/app/(dashboard)/brands/sourcing/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function SourcingCandidateActions({
  candidateId,
  verdict,
  locale,
}: {
  candidateId: string;
  verdict: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = React.useState<{ id: string } | { error: string } | null>(null);

  if (verdict === "reject") return null;

  const addedId = result && "id" in result ? result.id : null;
  if (addedId) {
    return (
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={`/brands/${addedId}`}>{t.sourcing.viewBrand}</Link>}
      />
    );
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await addSourcingCandidateToBrands(candidateId));
          })
        }
      >
        {isPending ? t.sourcing.adding : t.sourcing.addToBrands}
      </Button>
      {result && "error" in result && <p className="text-xs text-destructive">{result.error}</p>}
    </div>
  );
}
