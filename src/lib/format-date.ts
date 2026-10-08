import type { Locale } from "@/lib/i18n/dictionary";

/**
 * Every date/time on screen is shown in Korea time. Without an explicit timeZone,
 * toLocaleString uses the clock of whatever machine renders it: right on a laptop in Korea,
 * but 9 hours early on Vercel (UTC) -- a comment posted at 08:00 showed as 23:00 the day
 * before -- and client components rendered once on the server and again in the browser
 * could disagree with themselves.
 */
export const APP_TIME_ZONE = "Asia/Seoul";

function tag(locale: Locale | string) {
  return locale === "ko" ? "ko-KR" : "en-US";
}

/** "2026년 10월 8일" / "Oct 8, 2026" */
export function formatDate(d: Date | string, locale: Locale | string): string {
  return new Date(d).toLocaleDateString(tag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

/** "10월 8일 오전 08:05" / "Oct 8, 08:05 AM" -- for comments and log entries. */
export function formatShortDateTime(d: Date | string, locale: Locale | string): string {
  return new Date(d).toLocaleString(tag(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

/** Full date and time with seconds, e.g. a run's start time. */
export function formatDateTime(d: Date | string, locale: Locale | string): string {
  return new Date(d).toLocaleString(tag(locale), { timeZone: APP_TIME_ZONE });
}

/** Today's date in Korea as "YYYY-MM-DD" (en-CA formats dates that way). */
export function todayInAppTimeZone(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/**
 * A date-only DB value (stored as UTC midnight of the picked day, which is what
 * new Date("2026-10-08") produces) as "YYYY-MM-DD" for an <input type="date">.
 */
export function toDateInputValue(d: Date | string | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
