"""
Datasource registry — manages all data sources the chat pipeline can query.

Default: the pre-built conversations.duckdb (voicebot dataset, read-only).
Custom:  CSV / JSON / JSONL uploads, PostgreSQL snapshots, SQLite snapshots.
         Every custom source is snapshotted into an independent DuckDB file
         under backend/data/uploads/ at the moment it is connected.

The registry is in-memory; it resets on server restart.
"""

from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path
from typing import Any

import duckdb

import config

logger = logging.getLogger("uniai.datasource")

UPLOAD_DIR: Path = config.DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES: int = 100 * 1024 * 1024  # 100 MB

_REGISTRY: dict[str, dict[str, Any]] = {
    "default": {
        "id":          "default",
        "name":        "Voicebot Conversations",
        "type":        "duckdb",
        "db_path":     str(config.DB_PATH),
        "tables":      ["v_conversations", "v_turns", "v_evaluations",
                        "v_data_collection", "v_tool_calls"],
        "is_default":  True,
        "description": "Pre-built 90-day synthetic banking voicebot dataset (10,000 calls).",
    }
}


# ---------------------------------------------------------------------------
# Registry CRUD — every non-default datasource carries an owner_email field
# so that one user can never list, query, or delete another user's data.
# ---------------------------------------------------------------------------

def list_all(owner_email: str | None = None) -> list[dict[str, Any]]:
    """
    Return the default datasource plus any custom datasources owned by
    `owner_email`. With owner_email=None, returns only the default — useful
    for unauthenticated callers (kept for backwards compatibility).
    """
    return [
        ds for ds in _REGISTRY.values()
        if ds.get("is_default") or (owner_email and ds.get("owner_email") == owner_email)
    ]


def get(ds_id: str, owner_email: str | None = None) -> dict[str, Any] | None:
    """
    Return the datasource if it exists AND the caller is allowed to read it.
    Default datasource is always accessible; custom ones require an
    owner_email that matches.
    """
    ds = _REGISTRY.get(ds_id)
    if ds is None:
        return None
    if ds.get("is_default"):
        return ds
    if owner_email is None or ds.get("owner_email") != owner_email:
        return None
    return ds


def remove(ds_id: str, owner_email: str | None = None) -> bool:
    if ds_id == "default":
        return False
    ds = _REGISTRY.get(ds_id)
    if ds is None:
        return False
    if owner_email is None or ds.get("owner_email") != owner_email:
        return False
    _REGISTRY.pop(ds_id, None)
    Path(ds["db_path"]).unlink(missing_ok=True)
    logger.info("Removed datasource '%s' (%s) for %s",
                ds["name"], ds_id[:8], owner_email)
    return True


# ---------------------------------------------------------------------------
# File ingestion  (CSV · JSON · JSONL)
# ---------------------------------------------------------------------------

def ingest_file(
    file_bytes:  bytes,
    filename:    str,
    display_name: str = "",
    owner_email: str | None = None,
) -> dict[str, Any]:
    """
    Load a flat file into a fresh DuckDB.

    Supports: .csv  .json  .jsonl
    The table name is derived from the filename stem.
    """
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File size exceeds {MAX_UPLOAD_BYTES // 1_048_576} MB limit.")

    suffix = Path(filename).suffix.lower()
    if suffix not in (".csv", ".json", ".jsonl"):
        raise ValueError(
            f"Unsupported file type '{suffix}'. Accepted: .csv · .json · .jsonl"
        )

    ds_id    = uuid.uuid4().hex
    db_path  = UPLOAD_DIR / f"{ds_id}.duckdb"
    raw_path = UPLOAD_DIR / f"{ds_id}_{filename}"

    try:
        raw_path.write_bytes(file_bytes)
        table_name = _safe_name(Path(filename).stem)

        conn = duckdb.connect(str(db_path))
        if suffix == ".csv":
            conn.execute(
                f'CREATE TABLE "{table_name}" AS SELECT * FROM read_csv_auto(?)',
                [str(raw_path)],
            )
        else:
            conn.execute(
                f'CREATE TABLE "{table_name}" AS SELECT * FROM read_json_auto(?)',
                [str(raw_path)],
            )

        row_count = conn.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
        col_count = len(conn.execute(f'DESCRIBE "{table_name}"').fetchall())
        tables    = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
        conn.close()
    except Exception:
        db_path.unlink(missing_ok=True)
        raise
    finally:
        raw_path.unlink(missing_ok=True)

    ds: dict[str, Any] = {
        "id":          ds_id,
        "name":        display_name or filename,
        "type":        suffix.lstrip("."),
        "db_path":     str(db_path),
        "tables":      tables,
        "is_default":  False,
        "owner_email": owner_email,
        "description": f"{row_count:,} rows · {col_count} columns from {filename}",
        "schema_card": _safe_build_schema_card(str(db_path), tables),
    }
    _REGISTRY[ds_id] = ds
    logger.info(
        "Ingested %s '%s' → table '%s' (%d rows, ds=%s, owner=%s)",
        suffix, filename, table_name, row_count, ds_id[:8], owner_email,
    )
    return ds


# ---------------------------------------------------------------------------
# PostgreSQL snapshot
# ---------------------------------------------------------------------------

def connect_postgres(
    host:         str,
    port:         int,
    database:     str,
    user:         str,
    password:     str,
    tables:       list[str],
    display_name: str = "",
    owner_email:  str | None = None,
) -> dict[str, Any]:
    """
    Snapshot the requested PostgreSQL tables into a local DuckDB file.
    Data is copied once at connect time (not a live connection).

    Requires the duckdb postgres extension — installed automatically on first use.
    `tables` may use "schema.table" or just "table" notation.
    """
    if not tables:
        raise ValueError("Provide at least one table name to import.")

    ds_id    = uuid.uuid4().hex
    db_path  = UPLOAD_DIR / f"{ds_id}.duckdb"
    conn_str = (
        f"host={host} port={port} dbname={database} "
        f"user={user} password={password}"
    )

    conn = duckdb.connect(str(db_path))
    try:
        conn.execute("INSTALL postgres; LOAD postgres;")
        conn.execute(f"ATTACH '{conn_str}' AS _pg (TYPE POSTGRES, READ_ONLY)")

        imported: list[str] = []
        for table in tables:
            local_name = _safe_name(table.split(".")[-1])
            conn.execute(
                f'CREATE TABLE "{local_name}" AS SELECT * FROM _pg.{table}'
            )
            imported.append(local_name)

        conn.execute("DETACH _pg")
        total_rows = sum(
            conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
            for t in imported
        )
        conn.close()
    except Exception:
        conn.close()
        db_path.unlink(missing_ok=True)
        raise

    ds: dict[str, Any] = {
        "id":          ds_id,
        "name":        display_name or f"{database}@{host}",
        "type":        "postgres",
        "db_path":     str(db_path),
        "tables":      imported,
        "is_default":  False,
        "owner_email": owner_email,
        "description": (
            f"Snapshot of {len(imported)} table(s) from "
            f"{database}@{host}:{port} ({total_rows:,} total rows)"
        ),
        "connection_meta": {
            "host": host, "port": port,
            "database": database, "user": user,
        },
        "schema_card": _safe_build_schema_card(str(db_path), imported),
    }
    _REGISTRY[ds_id] = ds
    logger.info(
        "Snapshotted postgres %s → %d tables (ds=%s, owner=%s)",
        database, len(imported), ds_id[:8], owner_email,
    )
    return ds


# ---------------------------------------------------------------------------
# SQLite snapshot
# ---------------------------------------------------------------------------

def connect_sqlite(
    file_bytes:   bytes,
    filename:     str,
    display_name: str = "",
    owner_email:  str | None = None,
) -> dict[str, Any]:
    """
    Snapshot all user tables from a SQLite file into a local DuckDB.
    Requires the duckdb sqlite extension — installed automatically on first use.
    """
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File size exceeds {MAX_UPLOAD_BYTES // 1_048_576} MB limit.")

    ds_id       = uuid.uuid4().hex
    db_path     = UPLOAD_DIR / f"{ds_id}.duckdb"
    sqlite_path = UPLOAD_DIR / f"{ds_id}_{filename}"
    sqlite_path.write_bytes(file_bytes)

    conn = duckdb.connect(str(db_path))
    try:
        conn.execute("INSTALL sqlite; LOAD sqlite;")
        conn.execute(f"ATTACH '{sqlite_path}' AS _sqlite (TYPE SQLITE, READ_ONLY)")

        sqlite_tables = [
            r[0]
            for r in conn.execute(
                "SELECT name FROM _sqlite.sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        imported: list[str] = []
        for t in sqlite_tables:
            local_name = _safe_name(t)
            conn.execute(
                f'CREATE TABLE "{local_name}" AS SELECT * FROM _sqlite."{t}"'
            )
            imported.append(local_name)

        conn.execute("DETACH _sqlite")
        conn.close()
    except Exception:
        conn.close()
        db_path.unlink(missing_ok=True)
        raise
    finally:
        sqlite_path.unlink(missing_ok=True)

    ds: dict[str, Any] = {
        "id":          ds_id,
        "name":        display_name or filename,
        "type":        "sqlite",
        "db_path":     str(db_path),
        "tables":      imported,
        "is_default":  False,
        "owner_email": owner_email,
        "description": f"Snapshot of {len(imported)} table(s) from {filename}",
        "schema_card": _safe_build_schema_card(str(db_path), imported),
    }
    _REGISTRY[ds_id] = ds
    logger.info(
        "Snapshotted sqlite %s → %d tables (ds=%s, owner=%s)",
        filename, len(imported), ds_id[:8], owner_email,
    )
    return ds


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_name(name: str) -> str:
    """Produce a safe SQL identifier from a filename stem or table name."""
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", name).strip("_").lower()
    return clean or "data"


SAMPLE_ROWS_PER_TABLE = 3
MAX_TABLES_IN_CARD    = 25
MAX_COLUMNS_IN_CARD   = 60


def build_schema_card(db_path: str, tables: list[str]) -> str:
    """
    One-time profiling pass against a freshly snapshotted DuckDB. Returns a
    compact markdown card the chat pipeline injects into the custom-DS system
    prompt so the model can skip list_tables / get_table_schema on first turn.

    Truncated to keep token cost bounded on wide datasets — the model can
    still call get_table_schema for anything that overflowed.
    """
    truncated_tables = tables[:MAX_TABLES_IN_CARD]
    lines: list[str] = ["# Dataset schema (cached at upload time)\n"]

    conn = duckdb.connect(db_path, read_only=True)
    try:
        for table in truncated_tables:
            try:
                row_count = conn.execute(
                    f'SELECT COUNT(*) FROM "{table}"'
                ).fetchone()[0]
                columns = conn.execute(f'DESCRIBE "{table}"').fetchall()
                samples = conn.execute(
                    f'SELECT * FROM "{table}" LIMIT {SAMPLE_ROWS_PER_TABLE}'
                ).fetchall()
                col_names = [c[0] for c in columns]
            except Exception as exc:
                logger.warning("schema-card: skipping %s: %s", table, exc)
                continue

            lines.append(f"## `{table}` ({row_count:,} rows)\n")
            lines.append("Columns:")
            for cname, ctype, *_ in columns[:MAX_COLUMNS_IN_CARD]:
                lines.append(f"- `{cname}` ({ctype})")
            if len(columns) > MAX_COLUMNS_IN_CARD:
                lines.append(
                    f"- …{len(columns) - MAX_COLUMNS_IN_CARD} more columns "
                    f"(call get_table_schema for full list)"
                )

            if samples:
                lines.append("\nSample rows:")
                for row in samples:
                    preview = {
                        k: _truncate_cell(v)
                        for k, v in zip(col_names, row)
                    }
                    lines.append(f"- {preview}")
            lines.append("")
    finally:
        conn.close()

    if len(tables) > MAX_TABLES_IN_CARD:
        lines.append(
            f"_…{len(tables) - MAX_TABLES_IN_CARD} more tables — "
            f"call list_tables / get_table_schema for the rest._"
        )

    lines.append(
        "\nTrust this schema for the first query. If a column you need is "
        "missing or ambiguous, call `get_table_schema` to confirm before "
        "writing SQL."
    )
    return "\n".join(lines)


def _truncate_cell(v: Any, limit: int = 60) -> Any:
    """Keep sample-row previews compact so the schema card stays small."""
    if v is None:
        return None
    if isinstance(v, (int, float, bool)):
        return v
    s = str(v)
    return s if len(s) <= limit else s[:limit] + "…"


def _safe_build_schema_card(db_path: str, tables: list[str]) -> str | None:
    """Never let a profiling error break ingestion — log and return None."""
    try:
        return build_schema_card(db_path, tables)
    except Exception as exc:
        logger.warning("schema-card build failed for %s: %s", db_path, exc)
        return None
