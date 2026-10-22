"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { useClientLocale } from "@/lib/i18n/use-client-locale";

type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** No Cancel button, single button always resolves true -- replaces a plain window.alert(). */
  alertOnly?: boolean;
};

/**
 * Styled replacement for window.alert()/window.confirm() -- those are OS-native chrome
 * (the title bar literally reads "localhost:3000 says") with zero CSS control, so the
 * only way to put real design on a confirmation prompt is a real React dialog instead.
 * `confirm()` returns a Promise<boolean> so call sites keep the same
 * `if (!(await confirm(...))) return;` shape the native version had.
 */
export function useConfirmDialog() {
  // Default button labels follow the UI language (they used to be Korean in English mode),
  // and a delete confirm says "삭제/Delete" rather than a generic "확인".
  const t = getDictionary(useClientLocale()).common;
  const [state, setState] = React.useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(
    null
  );

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => setState({ options, resolve }));
  }, []);

  function settle(value: boolean) {
    state?.resolve(value);
    setState(null);
  }

  const dialog = (
    <Dialog open={state != null} onOpenChange={(open) => { if (!open) settle(false); }}>
      {state && (
        <DialogContent>
          {/* Always a title, so the dialog has a name for screen readers -- hidden when
              the call site didn't give one (the description says it all visually). */}
          <DialogHeader className={state.options.title ? undefined : "sr-only"}>
            <DialogTitle>
              {state.options.title ?? (state.options.alertOnly ? t.noticeTitle : t.confirmTitle)}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>{state.options.description}</DialogDescription>
          <DialogFooter>
            {!state.options.alertOnly && (
              <Button variant="outline" onClick={() => settle(false)}>
                {state.options.cancelLabel ?? t.cancel}
              </Button>
            )}
            <Button variant={state.options.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
              {state.options.confirmLabel ??
                (state.options.alertOnly ? t.ok : state.options.destructive ? t.delete : t.confirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );

  return { confirm, dialog };
}
