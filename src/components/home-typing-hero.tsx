"use client";

import * as React from "react";
import { cn } from "cn";

const TYPED_TEXT = "OnriKorea.ai";

export function HomeTypingHero({ className }: { className?: string }) {
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      if (!deleting) {
        i++;
        setText(TYPED_TEXT.slice(0, i));
        if (i === TYPED_TEXT.length) {
          deleting = true;
          timer = setTimeout(tick, 1400);
          return;
        }
        timer = setTimeout(tick, 90);
      } else {
        i--;
        setText(TYPED_TEXT.slice(0, i));
        if (i === 0) {
          deleting = false;
          timer = setTimeout(tick, 500);
          return;
        }
        timer = setTimeout(tick, 45);
      }
    }

    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <h1 className={cn(className, "relative inline-block")}>
      {/* Invisible full-width ghost reserves the box size up front so the typing
          animation never changes this element's footprint and shifts siblings. */}
      <span className="invisible" aria-hidden>
        {TYPED_TEXT}
      </span>
      <span className="absolute inset-y-0 left-0 inline-flex items-baseline">
        <span>{text}</span>
        <span
          className="ml-1 inline-block w-[3px] animate-pulse bg-primary sm:w-[4px]"
          style={{ height: "0.85em" }}
          aria-hidden
        />
      </span>
      <span className="sr-only">OnriKorea.ai</span>
    </h1>
  );
}
