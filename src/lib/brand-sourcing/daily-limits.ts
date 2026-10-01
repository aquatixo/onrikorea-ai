// Mirrors python-sourcing/config.py's DAILY_CANDIDATE_TARGET_* / DAILY_SEARCH_BUDGET_*.
// Display-only (the Python script is what actually enforces these) -- if those change,
// update here too so the always-visible status card on /brands/sourcing doesn't show a
// stale target/budget.
//
// Candidate target is per backend, not shared -- measured yield is roughly 1 new (flag)
// candidate per ~2.6 search calls, so Tavily's much smaller search budget (30) can only
// realistically reach ~11-12/day, nowhere near a shared target of 40. Showing "X / 40"
// for a backend whose budget runs out long before 40 is reachable was misleading.
export const DAILY_CANDIDATE_TARGET: Record<"serper" | "tavily", number> = {
  serper: 40,
  tavily: 15,
};
export const DAILY_SEARCH_BUDGET: Record<"serper" | "tavily", number> = {
  serper: 80,
  tavily: 30,
};
