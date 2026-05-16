"""
MCP server for the banking voicebot dataset.

Exposes six read-only tools over the pre-built DuckDB at backend/data/:
  - list_tables            enumerate the flat views and the raw table
  - get_table_schema       column dictionary for a single table/view
  - get_dataset_date_range min/max start_date ("today" = max date)
  - get_metrics_dictionary canonical KPI formulas from metrics_dictionary.md
  - get_schema_dictionary  column + intent catalog from schema.md
  - execute_sql            read-only SELECT/WITH queries, up to MAX_SQL_ROWS rows

Transport: stdio (spawned by main.py per chat request).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import duckdb
from mcp.server.fastmcp import FastMCP

from config import DB_PATH as _DEFAULT_DB_PATH, MAX_SQL_ROWS, METRICS_MD, SCHEMA_MD

# main.py passes UNIAI_DB_PATH when spawning for a custom datasource.
# Fall back to the default conversations.duckdb when not set.
_active_db = Path(os.environ.get("UNIAI_DB_PATH") or str(_DEFAULT_DB_PATH))

mcp = FastMCP("UniAI Data Server")
con = duckdb.connect(str(_active_db), read_only=True)


def _safe_select(query: str) -> bool:
    """Return True only for read-only SELECT/WITH statements."""
    q = query.strip().rstrip(";").lstrip()
    upper = q.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return False
    banned = (" INSERT ", " UPDATE ", " DELETE ", " DROP ", " ALTER ",
              " CREATE ", " ATTACH ", " COPY ", " PRAGMA ", " EXPORT ")
    padded = f" {upper} "
    return not any(b in padded for b in banned)


@mcp.tool()
def list_tables() -> str:
    """List all tables and views in the DuckDB database.

    Returns a JSON array of {name, type}. Prefer the v_* views — they flatten
    the nested raw structure for the most common access patterns.
    """
    rows = con.execute("""
        SELECT table_name AS name,
               CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS type
        FROM information_schema.tables
        WHERE table_schema = 'main'
        ORDER BY type DESC, name
    """).fetchall()
    return json.dumps([{"name": n, "type": t} for n, t in rows])


@mcp.tool()
def get_table_schema(table_name: str) -> str:
    """Get the columns and data types of a specific table or view.

    Returns a JSON array of {column_name, column_type, null, key, default, extra}.
    Validates the name against the catalog to prevent SQL injection via identifiers.
    """
    try:
        catalog = {r[0] for r in con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
        ).fetchall()}
        if table_name not in catalog:
            return json.dumps({"error": f"Unknown table/view: {table_name}. "
                                        f"Known: {sorted(catalog)}"})
        rows = con.execute(f'DESCRIBE "{table_name}"').fetchall()
        cols = [d[0] for d in con.description]
        return json.dumps([dict(zip(cols, r)) for r in rows], default=str)
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": str(exc)})


@mcp.tool()
def get_dataset_date_range() -> str:
    """Return the dataset's min/max start_date and total conversation count.

    For relative-date questions ("this week", "last 30 days"), use max_date as
    the dataset's "today" — the data is synthetic and frozen, not live.
    Only available for the default voicebot datasource.
    """
    try:
        row = con.execute(
            "SELECT MIN(start_date), MAX(start_date), COUNT(*) FROM v_conversations"
        ).fetchone()
        return json.dumps({
            "min_date": str(row[0]),
            "max_date": str(row[1]),
            "dataset_today": str(row[1]),
            "total_conversations": int(row[2]),
        })
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": str(exc)})


@mcp.tool()
def get_metrics_dictionary() -> str:
    """Return the canonical metrics dictionary verbatim from data/metrics_dictionary.md.

    Covers containment rate, escalation rate, abandonment, CSAT, AHT, FCR,
    tool success rate, cost per call, and repeat-caller rate.
    Call this before composing SQL for any KPI so the formula is authoritative.
    """
    if not METRICS_MD.exists():
        return json.dumps({"error": f"metrics_dictionary.md not found at {METRICS_MD}"})
    return METRICS_MD.read_text()


@mcp.tool()
def get_schema_dictionary() -> str:
    """Return the column dictionary verbatim from data/schema.md.

    Documents every column in every view, the intent catalog, evaluation
    criteria, and data-collection fields. Use before querying unfamiliar columns.
    """
    if not SCHEMA_MD.exists():
        return json.dumps({"error": f"schema.md not found at {SCHEMA_MD}"})
    return SCHEMA_MD.read_text()


@mcp.tool()
def execute_sql(query: str) -> str:
    """Execute a single read-only SELECT or WITH … SELECT against the DuckDB.

    Returns up to MAX_SQL_ROWS rows as a JSON array of objects. Shape the
    SELECT so the result is already chart-ready — name/value for categorical
    charts, x/y for time-series — so no post-processing is needed.
    """
    if not _safe_select(query):
        return json.dumps({"error": "Only read-only SELECT/WITH queries are allowed."})
    try:
        rows = con.execute(query).fetchmany(MAX_SQL_ROWS)
        cols = [d[0] for d in con.description]
        return json.dumps([dict(zip(cols, r)) for r in rows], default=str)
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": str(exc)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
