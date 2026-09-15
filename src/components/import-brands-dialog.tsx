"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importBrandsFromExcel } from "@/app/brands/import-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function ImportBrandsDialog({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = React.useState<string[]>([]);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setErrors([]);
      setSuccessCount(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrors([t.brandImport.noFileChosen]);
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    setErrors([]);
    startTransition(async () => {
      const result = await importBrandsFromExcel(formData);
      if (result.success) {
        setSuccessCount(result.count);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="size-4" /> {t.brandImport.trigger}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.brandImport.title}</DialogTitle>
          <DialogDescription>{t.brandImport.description}</DialogDescription>
        </DialogHeader>

        {successCount !== null ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {t.brandImport.successMessage(successCount)}
            </p>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>{t.brandImport.close}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <a
              href="/api/brands/import-template"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Download className="size-4" />
              {t.brandImport.downloadTemplate}
            </a>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />

            {errors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-xs font-medium text-destructive">{t.brandImport.errorsTitle}</p>
                <ul className="list-inside list-disc text-xs text-destructive">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? t.brandImport.importing : t.brandImport.submit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
