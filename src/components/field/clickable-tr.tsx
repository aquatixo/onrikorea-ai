"use client";

import { useRouter } from "next/navigation";

/** Same as ClickableRow but for a plain <tr> (the Store Visit Detail items list is a raw
 * <table>, not the shared Table component). */
export function ClickableTr({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(href)} className="cursor-pointer align-top transition-colors hover:bg-muted/40">
      {children}
    </tr>
  );
}
