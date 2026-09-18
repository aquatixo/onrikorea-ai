"use client";

/** Wraps action buttons/links inside a ClickableRow/ClickableTr so clicking them doesn't
 * also trigger the row's own navigation. `display: contents` keeps it invisible to layout. */
export function StopPropagation({ children }: { children: React.ReactNode }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="contents">
      {children}
    </div>
  );
}
