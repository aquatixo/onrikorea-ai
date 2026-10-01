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
    <h1 className={cn(className, "relative flex h-[38px] items-center sm:h-[60px]")}>
      {/* Invisible full-text ghost reserves the width; the explicit fixed height above
          (matching this font size's line-height) reserves the height. Together the
          typing animation never resizes this element or shifts the badge/buttons
          around it, regardless of how many characters are currently typed. */}
      <span className="invisible" aria-hidden>
        {TYPED_TEXT}
      </span>
      <span className="absolute inset-0 flex items-center">
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
