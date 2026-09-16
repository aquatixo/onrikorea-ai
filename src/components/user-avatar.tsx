import { cn } from "cn";
import { avatarStyle, initials } from "@/lib/avatar-color";

export function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        avatarStyle(name)
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
