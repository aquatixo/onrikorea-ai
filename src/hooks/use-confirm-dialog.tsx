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
          {state.options.title && (
            <DialogHeader>
              <DialogTitle>{state.options.title}</DialogTitle>
            </DialogHeader>
          )}
          <DialogDescription>{state.options.description}</DialogDescription>
          <DialogFooter>
            {!state.options.alertOnly && (
              <Button variant="outline" onClick={() => settle(false)}>
                {state.options.cancelLabel ?? "취소"}
              </Button>
            )}
            <Button variant={state.options.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
              {state.options.confirmLabel ?? "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );

  return { confirm, dialog };
}
