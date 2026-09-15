"use client";

import * as React from "react";
import { useTransition } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExcelIcon } from "@/components/icons/excel-icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function SyncSharePointDialog({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [open, setOpen] = React.useState(false);
  const [isDownloading, startDownloading] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [hasBackedUp, setHasBackedUp] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setHasBackedUp(false);
      setError(null);
      setSuccessCount(null);
    }
  }

  function handleDownloadBackup() {
    setError(null);
    startDownloading(async () => {
      const res = await fetch("/api/brands/sync/backup");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? t.sync.backupFailed);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "backup.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setHasBackedUp(true);
    });
  }

  function handleConfirmOverwrite() {
    if (!hasBackedUp) {
      setError(t.sync.needBackupFirst);
      return;
    }
    setError(null);
    startSyncing(async () => {
      const res = await fetch("/api/brands/sync/push", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.error ?? t.sync.syncFailed);
        return;
      }
      setSuccessCount(body.count);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <RefreshCw className="size-4" /> {t.sync.trigger}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.sync.title}</DialogTitle>
        </DialogHeader>

        {successCount !== null ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              {t.sync.successMessage(successCount)}
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>{t.sync.close}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <DialogDescription className="text-amber-800 dark:text-amber-300">
                {t.sync.caution}
              </DialogDescription>
            </div>

            <Button variant="outline" onClick={handleDownloadBackup} disabled={isDownloading}>
              <ExcelIcon className="size-4" />
              {hasBackedUp ? t.sync.backupDownloaded : t.sync.downloadBackup}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button onClick={handleConfirmOverwrite} disabled={!hasBackedUp || isSyncing}>
                {isSyncing ? t.sync.syncing : t.sync.confirmOverwrite}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
