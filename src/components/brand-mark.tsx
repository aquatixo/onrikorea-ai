import { cn } from "cn";

// Approximated from the reference image (exact hex/heights not provided) -- adjust if
// these should match an existing brand-color spec.
const BARS = [
  { color: "#E0457B", ratio: 1 },
  { color: "#8DC63F", ratio: 0.72 },
  { color: "#F7931E", ratio: 0.92 },
  { color: "#3B9FE0", ratio: 0.8 },
];

/**
 * The four-bar brand mark. Pass `animated` to make the bars bounce like an equalizer
 * (used for the full-screen loading state) -- otherwise renders static (used in the
 * sidebar's home/logo spot).
 */
export function BrandMark({
  size = 32,
  animated = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const barWidth = size * 0.28;
  const gap = size * 0.12;

  return (
    <div
      className={cn("flex items-end", className)}
      style={{ height: size, gap }}
      role="img"
      aria-label="onrikorea.ai"
    >
      {animated && (
        <style>{`
          @keyframes onri-bar-bounce {
            0%, 100% { transform: scaleY(0.4); }
            50% { transform: scaleY(1); }
          }
        `}</style>
      )}
      {BARS.map((bar, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="rounded-full"
          style={{
            width: barWidth,
            height: size * bar.ratio,
            backgroundColor: bar.color,
            transformOrigin: "bottom",
            ...(animated
              ? {
                  animationName: "onri-bar-bounce",
                  animationDuration: "1s",
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDelay: `${i * 150}ms`,
                }
              : {}),
          }}
        />
      ))}
    </div>
  );
}
