"""Direct Postgres access, writing into the same SourcingRun/SourcingCandidate tables
the Claude-based pipeline uses (see prisma/schema.prisma) -- same results table on
/brands/sourcing either way, distinguished by the `methodology` field.

Prisma's `@default(uuid())` generates the id in the Node client, not in Postgres, so
writing directly via psycopg2 means generating the id ourselves too."""

import uuid
from datetime import datetime, timezone
import psycopg2
from config import DATABASE_URL


def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set in .env")
    return psycopg2.connect(DATABASE_URL)


def create_sourcing_run(conn) -> str:
    run_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "SourcingRun" (id, "createdAt") VALUES (%s, %s)', (run_id, datetime.now(timezone.utc)))
    conn.commit()
    return run_id


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
