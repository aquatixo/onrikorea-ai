"use client";

import * as React from "react";
import { useTransition } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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

type Preview = { toAddToSheet: number; toAddToDb: number; matched: number };
type SyncResult = { addedToSheet: number; addedToDb: number };

export function SyncSharePointDialog({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [open, setOpen] = React.useState(false);
  const [isPreviewing, startPreviewing] = useTransition();
  const [isDownloading, startDownloading] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [hasBackedUp, setHasBackedUp] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SyncResult | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setError(null);
      startPreviewing(async () => {
        const res = await fetch("/api/brands/sync/preview");
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          setError(body?.error ?? t.sync.previewFailed);
          return;
        }
        setPreview(body);
      });
    } else {
      setPreview(null);
      setHasBackedUp(false);
      setError(null);
      setResult(null);
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

  function handleConfirmSync() {
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
      setResult({ addedToSheet: body.addedToSheet, addedToDb: body.addedToDb });
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

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              {t.sync.successMessage(result.addedToDb, result.addedToSheet)}
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>{t.sync.close}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogDescription>{t.sync.caution}</DialogDescription>

            {isPreviewing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t.sync.previewing}
              </div>
            ) : (
              preview && (
                <ul className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <li>{t.sync.previewToDb(preview.toAddToDb)}</li>
                  <li>{t.sync.previewToSheet(preview.toAddToSheet)}</li>
                  <li className="text-muted-foreground">{t.sync.previewMatched(preview.matched)}</li>
                </ul>
              )
            )}

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{t.sync.backupReason}</p>
            </div>

            <Button variant="outline" onClick={handleDownloadBackup} disabled={isDownloading}>
              <ExcelIcon className="size-4" />
              {hasBackedUp ? t.sync.backupDownloaded : t.sync.downloadBackup}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button onClick={handleConfirmSync} disabled={!hasBackedUp || isSyncing || isPreviewing}>
                {isSyncing ? t.sync.syncing : t.sync.confirmSync}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
