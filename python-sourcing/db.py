"""Direct Postgres access, writing into the same SourcingRun/SourcingCandidate tables
the Claude-based pipeline uses (see prisma/schema.prisma) -- same results table on
/brands/sourcing either way, distinguished by the `methodology` field.

Prisma's `@default(uuid())` generates the id in the Node client, not in Postgres, so
writing directly via psycopg2 means generating the id ourselves too."""

import json
import uuid
from datetime import datetime, timezone
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


def create_sourcing_run(conn) -> str:
    """Only used when main.py is run standalone (no run id passed in) -- normally the
    Node Server Action creates the SourcingRun row itself so the UI can start polling it
    before the python process has even finished starting up."""
    run_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "SourcingRun" (id, "createdAt", status) VALUES (%s, %s, %s)',
            (run_id, datetime.now(timezone.utc), "running"),
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
