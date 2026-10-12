"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "cn";

/** For a results-table cell whose content is often too long to fit -- truncated by
 * default to keep rows compact, but a click expands just this cell (wrapping to
 * multiple lines) so the full text is always reachable without relying on a hover
 * tooltip. Used for both a candidate's name and its (often much longer) reason/notes
 * text, which is why this takes a generic `text` rather than being name-specific.
 *
 * The expand chevron only appears once the text actually overflows its cell (measured
 * via scrollWidth vs clientWidth, not a character-count guess) -- showing it
 * unconditionally on every row, even text that already fits, looked like a stray UI
 * affordance hinting at hidden functionality that wasn't there. */
export function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const elRef = React.useRef<HTMLSpanElement | null>(null);
  const observerRef = React.useRef<ResizeObserver | null>(null);

  const measure = React.useCallback(() => {
    const el = elRef.current;
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth);
  }, []);

  // A callback ref (not a plain useRef + effect-on-mount) because this component swaps
  // which element it renders (plain span <-> the button's span) once isTruncated flips --
  // a plain ref's observer would stay attached to the old, now-unmounted node forever.
  const attachRef = React.useCallback(
    (el: HTMLSpanElement | null) => {
      elRef.current = el;
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!el) return;
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      observerRef.current = observer;
    },
    [measure]
  );

  // Re-measures the same element when just the text changes without a re-mount.
  React.useEffect(() => {
    measure();
  }, [text, measure]);

  React.useEffect(() => () => observerRef.current?.disconnect(), []);

  if (!isTruncated && !expanded) {
    return (
      <span ref={attachRef} className="block truncate">
        {text}
      </span>
    );
  }

  // Only the chevron is a <button>: text inside a button can't be drag-selected, so a long
  // name used to be impossible to copy. Clicking the text still toggles, unless the click
  // was the end of a drag that selected some of it.
  function toggle(e: React.MouseEvent) {
    // Stops the click from bubbling up to a clickable row (e.g. the Brands list row,
    // which navigates to the brand's detail page on any click) -- expanding or selecting
    // text should never accidentally trigger navigation.
    e.stopPropagation();
    if (window.getSelection()?.toString()) return;
    setExpanded((v) => !v);
  }

  return (
    <div className="flex w-full items-start gap-1 text-left">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={text}
        className="mt-0.5 shrink-0 rounded text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      <span
        ref={attachRef}
        onClick={toggle}
        className={cn("min-w-0 flex-1 cursor-pointer", expanded ? "whitespace-normal break-words" : "truncate")}
      >
        {text}
      </span>
    </div>
  );
}
