"""Errors that mean "searching can't work at all right now", as opposed to one query
failing. A missing or rejected API key, or used-up credits, fails EVERY search the same
way -- swallowing it per query (like an ordinary network hiccup) let a keyless run "use"
the whole daily budget in seconds, record every query as finding nothing (retiring the
hand-written ones) and finish as "done" with no visible error. Raised by serper_search /
tavily_search, never caught per query, and turned into a run error by main.py.
"""


class SearchAuthError(RuntimeError):
    """Missing/invalid API key or exhausted credits -- stop the whole run."""
