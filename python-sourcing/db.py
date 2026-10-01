"""Direct Postgres access, writing into the same SourcingRun/SourcingCandidate tables
the Claude-based pipeline uses (see prisma/schema.prisma) -- same results table on
/brands/sourcing either way, distinguished by the `methodology` field.

Prisma's `@default(uuid())` generates the id in the Node client, not in Postgres, so
writing directly via psycopg2 means generating the id ourselves too."""

import json
import uuid
from datetime import datetime, timezone, date
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
import psycopg2
from config import DATABASE_URL


def _clean_dsn(url: str) -> str:
    """psycopg2/libpq doesn't recognize Supabase's `pgbouncer=true` query param --
    that's a hint Prisma's own driver adapter understands, not a real libpq connection
    option, and a plain psycopg2.connect() rejects the whole DSN as invalid because of
    it. Strip it out, keep everything else (e.g. sslmode) as-is."""
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    query.pop("pgbouncer", None)
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set in .env")
    return psycopg2.connect(_clean_dsn(DATABASE_URL))


def create_sourcing_run(conn, backend: str = "serper") -> str:
    """Only used when main.py is run standalone (no run id passed in) -- normally the
    Node Server Action creates the SourcingRun row itself so the UI can start polling it
    before the python process has even finished starting up."""
    run_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "SourcingRun" (id, "createdAt", status, backend) VALUES (%s, %s, %s, %s)',
            (run_id, datetime.now(timezone.utc), "running", backend),
        )
    conn.commit()
    return run_id


def update_run_progress(conn, run_id: str, progress: dict, status: str | None = None) -> None:
    with conn.cursor() as cur:
        if status:
            cur.execute(
                'UPDATE "SourcingRun" SET progress = %s::jsonb, status = %s WHERE id = %s',
                (json.dumps(progress), status, run_id),
            )
        else:
            cur.execute(
                'UPDATE "SourcingRun" SET progress = %s::jsonb WHERE id = %s',
                (json.dumps(progress), run_id),
            )
    conn.commit()


def insert_candidate(conn, run_id: str, candidate: dict) -> None:
    candidate_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "SourcingCandidate"
                (id, "runId", name, methodology, country, sku, "foundedYear", website, verdict, reason, evidence, "createdAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                candidate_id,
                run_id,
                candidate["name"],
                candidate.get("methodology"),
                candidate.get("country"),
                candidate.get("sku"),
                candidate.get("foundedYear"),
                candidate.get("website"),
                candidate["verdict"],
                candidate["reason"],
                candidate.get("evidence", []),
                datetime.now(timezone.utc),
            ),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Daily-run state: SourcingQueryLedger / SourcingLaneState / SourcingDailyBudget
# (see prisma/schema.prisma for the full rationale comment)
# ---------------------------------------------------------------------------


def get_or_create_daily_budget(conn, backend: str, run_date: date) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "searchUsed", "candidatesOut", "stoppedBy" FROM "SourcingDailyBudget" WHERE backend = %s AND "runDate" = %s',
            (backend, run_date),
        )
        row = cur.fetchone()
        if row:
            return {"searchUsed": row[0], "candidatesOut": row[1], "stoppedBy": row[2]}
        cur.execute(
            'INSERT INTO "SourcingDailyBudget" (backend, "runDate", "searchUsed", "candidatesOut") VALUES (%s, %s, 0, 0)',
            (backend, run_date),
        )
    conn.commit()
    return {"searchUsed": 0, "candidatesOut": 0, "stoppedBy": None}


def update_daily_budget(
    conn, backend: str, run_date: date, search_used: int, candidates_out: int, stopped_by: str | None = None
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "SourcingDailyBudget" SET "searchUsed" = %s, "candidatesOut" = %s, "stoppedBy" = COALESCE(%s, "stoppedBy") WHERE backend = %s AND "runDate" = %s',
            (search_used, candidates_out, stopped_by, backend, run_date),
        )
    conn.commit()


def get_lane_state(conn, backend: str, lane_code: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "cursor", exhausted, "totalNewBrands" FROM "SourcingLaneState" WHERE backend = %s AND "laneCode" = %s',
            (backend, lane_code),
        )
        row = cur.fetchone()
        if row:
            return {"cursor": row[0], "exhausted": row[1], "totalNewBrands": row[2]}
    return {"cursor": 0, "exhausted": False, "totalNewBrands": 0}


def save_lane_state(conn, backend: str, lane_code: str, cursor: int, exhausted: bool, total_new_brands: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "SourcingLaneState" (backend, "laneCode", "cursor", exhausted, "lastRunAt", "totalNewBrands")
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (backend, "laneCode") DO UPDATE SET
                "cursor" = EXCLUDED."cursor",
                exhausted = EXCLUDED.exhausted,
                "lastRunAt" = EXCLUDED."lastRunAt",
                "totalNewBrands" = EXCLUDED."totalNewBrands"
            """,
            (backend, lane_code, cursor, exhausted, datetime.now(timezone.utc), total_new_brands),
        )
    conn.commit()


def is_query_retired(conn, backend: str, lane_code: str, query_text: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT retired FROM "SourcingQueryLedger" WHERE backend = %s AND "laneCode" = %s AND "queryText" = %s',
            (backend, lane_code, query_text),
        )
        row = cur.fetchone()
        return bool(row and row[0])


def record_query_result(conn, backend: str, lane_code: str, query_text: str, results_count: int, new_candidates: int) -> bool:
    """Upserts this query's ledger row and returns whether it's now retired (2
    consecutive zero-new-candidate runs)."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "consecutiveZeroRuns" FROM "SourcingQueryLedger" WHERE backend = %s AND "laneCode" = %s AND "queryText" = %s',
            (backend, lane_code, query_text),
        )
        row = cur.fetchone()
        prev_streak = row[0] if row else 0
        streak = 0 if new_candidates > 0 else prev_streak + 1
        retired = streak >= 2

        cur.execute(
            """
            INSERT INTO "SourcingQueryLedger"
                (id, backend, "laneCode", "queryText", "executedAt", "timesRun", "resultsCount", "newCandidates", "consecutiveZeroRuns", retired)
            VALUES (%s, %s, %s, %s, %s, 1, %s, %s, %s, %s)
            ON CONFLICT (backend, "laneCode", "queryText") DO UPDATE SET
                "executedAt" = EXCLUDED."executedAt",
                "timesRun" = "SourcingQueryLedger"."timesRun" + 1,
                "resultsCount" = EXCLUDED."resultsCount",
                "newCandidates" = EXCLUDED."newCandidates",
                "consecutiveZeroRuns" = EXCLUDED."consecutiveZeroRuns",
                retired = EXCLUDED.retired
            """,
            (str(uuid.uuid4()), backend, lane_code, query_text, datetime.now(timezone.utc), results_count, new_candidates, streak, retired),
        )
    conn.commit()
    return retired
