import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

/** Centered full-height message used by the 404 and error screens. */
export function StatusScreen({
  code,
  title,
  body,
  children,
}: {
  code?: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <BrandMark size={56} />
        {code && <p className="font-mono text-sm font-semibold text-muted-foreground">{code}</p>}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        {children && <div className="flex flex-wrap items-center justify-center gap-2 pt-2">{children}</div>}
      </div>
    </main>
  );
}
