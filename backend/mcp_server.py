"""
MCP server for the banking voicebot dataset.

Exposes read-only tools over a pre-built DuckDB (do not regenerate the data):
  - list_tables           : enumerate the flat views and the raw table
  - get_table_schema      : column dictionary for a single table/view
  - get_dataset_date_range: the min/max start_date in v_conversations
                            ("today" for the dataset = max start_date)
  - get_metrics_dictionary: canonical metric definitions (loaded from the
                            data/metrics_dictionary.md shipped with the dataset
                            so every team computes the same number)
  - get_schema_dictionary : data/schema.md, the column dictionary
  - execute_sql           : run a single read-only SELECT/WITH query

The LLM is expected to:
  1. read get_metrics_dictionary to anchor on canonical formulas,
  2. call get_table_schema for any view it queries,
  3. emit a single execute_sql call per chart component,
  4. shape the result into the dashboard-component contract that main.py asks
     for in its system prompt.
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Banking Voicebot Data Server")

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "conversations.duckdb"

# The dataset repo ships the canonical metric definitions + column dictionary
# as markdown. Resolve them so the LLM can read the same source of truth a
# human would. We resolve at import-time so a misplaced repo fails loudly.
DATA_DOCS_DIR = BASE_DIR.parent.parent / "makeathon-NR2Dashboard-main" / "data"
METRICS_MD = DATA_DOCS_DIR / "metrics_dictionary.md"
SCHEMA_MD = DATA_DOCS_DIR / "schema.md"

con = duckdb.connect(str(DB_PATH), read_only=True)


def _safe_select(query: str) -> bool:
    q = query.strip().rstrip(";").lstrip()
    upper = q.upper()
    if upper.startswith("SELECT") or upper.startswith("WITH"):
        # Block obvious write keywords even inside a WITH/CTE.
        banned = (" INSERT ", " UPDATE ", " DELETE ", " DROP ", " ALTER ",
                  " CREATE ", " ATTACH ", " COPY ", " PRAGMA ", " EXPORT ")
        padded = f" {upper} "
        return not any(b in padded for b in banned)
    return False


@mcp.tool()
def list_tables() -> str:
    """List all tables and views available in the DuckDB database.

    Returns a JSON array of {name, type}. Prefer the `v_*` views — they flatten
    the nested raw structure for the most common slices.
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
    """Get the column names and data types of a specific table or view.

    Returns a JSON array of {column_name, column_type, null, key, default, extra}.
    """
    try:
        # parameterised identifier — DESCRIBE doesn't accept ? binds, so we
        # validate against the known catalog first.
        catalog = {r[0] for r in con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
        ).fetchall()}
        if table_name not in catalog:
            return json.dumps({"error": f"Unknown table/view: {table_name}. "
                                        f"Known: {sorted(catalog)}"})
        rows = con.execute(f'DESCRIBE "{table_name}"').fetchall()
        cols = [d[0] for d in con.description]
        return json.dumps([dict(zip(cols, r)) for r in rows], default=str)
    except Exception as e:  # noqa: BLE001
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_dataset_date_range() -> str:
    """Return the dataset's min/max `start_date` plus the count of conversations.

    For relative-date questions ("this week", "yesterday", "last 30 days"),
    treat `max_date` as the dataset's "today" — the synthetic data is frozen,
    not live.
    """
    row = con.execute(
        "SELECT MIN(start_date), MAX(start_date), COUNT(*) FROM v_conversations"
    ).fetchone()
    return json.dumps({
        "min_date": str(row[0]),
        "max_date": str(row[1]),
        "dataset_today": str(row[1]),
        "total_conversations": int(row[2]),
    })


@mcp.tool()
def get_metrics_dictionary() -> str:
    """Return the canonical metrics dictionary (containment, escalation, CSAT,
    AHT, FCR, etc.) verbatim from `data/metrics_dictionary.md`.

    Read this BEFORE composing SQL for any KPI — every team must compute the
    same number for the same word.
    """
    if not METRICS_MD.exists():
        return json.dumps({"error": f"metrics_dictionary.md not found at {METRICS_MD}"})
    return METRICS_MD.read_text()


@mcp.tool()
def get_schema_dictionary() -> str:
    """Return the column dictionary (`data/schema.md`) — the authoritative
    reference for what every field means, the intent catalog, and the
    `v_*` flat views.
    """
    if not SCHEMA_MD.exists():
        return json.dumps({"error": f"schema.md not found at {SCHEMA_MD}"})
    return SCHEMA_MD.read_text()


@mcp.tool()
def execute_sql(query: str) -> str:
    """Execute a single read-only SELECT (or WITH … SELECT) against the DuckDB.

    Returns up to 500 rows as a JSON array of objects. Use this once per
    chart component — shape the SELECT so the result is already in the
    chart-ready form (label/value, or x/y for time series).
    """
    if not _safe_select(query):
        return json.dumps({"error": "Only read-only SELECT/WITH queries are allowed."})
    try:
        rows = con.execute(query).fetchmany(500)
        cols = [d[0] for d in con.description]
        return json.dumps([dict(zip(cols, r)) for r in rows], default=str)
    except Exception as e:  # noqa: BLE001
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
