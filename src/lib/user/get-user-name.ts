/**
 * Stand-in for a real logged-in identity until auth is wired up. There's no login or
 * roles system yet (explicitly deferred until after brand sourcing), so every comment
 * and edit is attributed to "Admin" -- not a per-browser customizable name, since that
 * would contradict there being no real identity yet. Once real auth exists, this should
 * read the actual signed-in user instead.
 */
export async function getUserName(): Promise<string> {
  return "Admin";
}
