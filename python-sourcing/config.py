import os
from dotenv import load_dotenv

# Loads the project's .env from the current working directory (the Node Server Action
# spawns this with cwd set to the project root, so this finds the same .env Next.js uses).
load_dotenv()

SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")
# Lets evaluate_client.py's server-to-server call into /api/brands/evaluate-candidate
# skip the browser-session check that route otherwise requires -- this script has no
# NextAuth session to send. See the route's own comment for the other half of this.
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")

# Replaces the old MAX_CANDIDATES_PER_BUCKET=6 cap -- that capped output AFTER already
# spending the search credits to discover it, and cut by result order, not quality.
# Control is now a daily stop condition instead: keep going (round-robin across lanes,
# resuming each lane's saved cursor) until either is hit.
#
# Search-call budget is per backend, since each has a very different quota shape:
# Serper is 2,500 CREDITS ONE-TIME (no monthly reset) -- 80/day spends it over ~31 days.
# Tavily is 1,000 credits/month, RECURRING -- 30/day paces it to roughly match the
# monthly reset instead of front-loading the whole month's quota into the first ~2 weeks.
DAILY_SEARCH_BUDGET_SERPER = 80
DAILY_SEARCH_BUDGET_TAVILY = 30

# Candidate target is ALSO per backend now, not a shared human-review-capacity number --
# a single fixed target doesn't make sense once the search budgets differ this much.
# Measured yield in real runs is roughly 1 new (flag) candidate per ~2.6 search calls
# (Serper: 84 calls -> 32 candidates; Tavily: 32 calls -> 12 candidates, both close to
# that ratio), so 80 calls realistically caps out well under 40 and 30 calls caps out
# around 11-12 -- a Tavily target of 40 was never reachable before its search budget
# ran out, which made the "candidates" progress bar meaningless for that backend.
DAILY_CANDIDATE_TARGET_SERPER = 40
DAILY_CANDIDATE_TARGET_TAVILY = 15
