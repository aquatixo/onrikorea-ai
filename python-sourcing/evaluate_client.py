"""Calls the app's own /api/brands/evaluate-candidate route -- this was built
specifically so an external script (this one) could reuse the exact same dedup +
category-exclusion logic the app already has, instead of re-implementing it in
Python and risking the two copies drifting apart."""

import requests
from config import APP_BASE_URL


def evaluate_candidate(candidate: dict) -> dict:
    resp = requests.post(f"{APP_BASE_URL}/api/brands/evaluate-candidate", json=candidate, timeout=15)
    resp.raise_for_status()
    return resp.json()
