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

import difflib
import json
import os
import re
from pathlib import Path

import duckdb
import sqlglot
from sqlglot import expressions as exp
from mcp.server.fastmcp import FastMCP

from config import DB_PATH as _DEFAULT_DB_PATH, MAX_SQL_ROWS, METRICS_MD, SCHEMA_MD

# main.py passes UNIAI_DB_PATH when spawning for a custom datasource.
# Fall back to the default conversations.duckdb when not set.
_active_db = Path(os.environ.get("UNIAI_DB_PATH") or str(_DEFAULT_DB_PATH))

mcp = FastMCP("UniAI Data Server")
con = duckdb.connect(str(_active_db), read_only=True)


# ---------------------------------------------------------------------------
# SQL safety — parse the query into an AST and reject anything that isn't
# a single, pure SELECT/WITH (no DDL, DML, ATTACH, PRAGMA, COPY, etc.).
# Substring-keyword checks are fragile; an AST walk is the only defensible
# way to know what a query actually does.
# ---------------------------------------------------------------------------

# Any one of these inside the parse tree → reject the whole query.
# exp.Command catches statements sqlglot doesn't recognise as SELECT
# (PRAGMA, ATTACH, COPY, EXPORT, INSTALL, LOAD, SET, …).
_FORBIDDEN_NODES = (
    exp.Insert, exp.Update, exp.Delete,
    exp.Create, exp.Drop, exp.Alter,
    exp.Command,
)


def _safe_select(query: str) -> tuple[bool, str]:
    """
    Validate that `query` is a single read-only SELECT or WITH-then-SELECT.

    Returns (allowed, reason). `reason` is empty when allowed; otherwise it's
    a short human-readable explanation the LLM can use to self-correct.
    """
    q = query.strip().rstrip(";")
    if not q:
        return False, "Empty query."

    try:
        statements = sqlglot.parse(q, dialect="duckdb")
    except sqlglot.errors.ParseError as exc:
        return False, f"SQL parse error: {exc}"

    statements = [s for s in statements if s is not None]
    if len(statements) != 1:
        return False, "Exactly one SQL statement is allowed per call."

    root = statements[0]

    # Top-level must be a SELECT (CTEs attach to Select in sqlglot) or a
    # set operation like UNION. Anything else (PRAGMA, ATTACH, …) is a
    # Command node and gets rejected by the walk below anyway, but we
    # short-circuit here for a clearer error message.
    if not isinstance(root, (exp.Select, exp.Union)):
        return False, (
            f"Only SELECT/WITH queries are allowed "
            f"(got {type(root).__name__.upper()})."
        )

    bad = next(root.find_all(*_FORBIDDEN_NODES), None)
    if bad is not None:
        return False, f"Forbidden operation in query: {type(bad).__name__.upper()}."

    return True, ""


# ---------------------------------------------------------------------------
# Error-to-suggestion — when DuckDB rejects a query because the model used
# a column that doesn't exist, return structured hints so the next reasoning
# step can self-correct instead of giving up.
# ---------------------------------------------------------------------------

_BAD_IDENT_PATTERNS = (
    re.compile(r'Referenced column "?([^"\s]+)"?', re.IGNORECASE),
    re.compile(r'column "?([^"\s]+)"? (?:does not exist|not found)', re.IGNORECASE),
    re.compile(r'unknown column "?([^"\s]+)"?', re.IGNORECASE),
    re.compile(r"['\"]([\w.]+)['\"] does not exist", re.IGNORECASE),
)


def _all_column_names() -> list[str]:
    try:
        rows = con.execute(
            "SELECT DISTINCT column_name FROM information_schema.columns "
            "WHERE table_schema = 'main'"
        ).fetchall()
        return [r[0] for r in rows]
    except Exception:  # noqa: BLE001
        return []


def _suggest_fix(error_msg: str) -> dict:
    """
    Extract the offending identifier from a DuckDB error and offer
    close matches from the live schema. The LLM consumes `suggested_columns`
    in its next turn.
    """
    out: dict = {"error": error_msg}

    bad_id: str | None = None
    for pat in _BAD_IDENT_PATTERNS:
        m = pat.search(error_msg)
        if m:
            bad_id = m.group(1).strip()
            break
    if not bad_id:
        return out

    candidates = _all_column_names()
    if not candidates:
        return out

    matches = difflib.get_close_matches(bad_id, candidates, n=5, cutoff=0.55)
    if matches:
        out["bad_identifier"]    = bad_id
        out["suggested_columns"] = matches
        out["hint"] = (
            f"Column '{bad_id}' does not exist. Did you mean: "
            f"{', '.join(matches)}? Call get_table_schema to verify column names "
            f"before retrying execute_sql."
        )
    return out


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

    On failure, returns {"error": …} and, when the error is a column-not-
    found, includes {"bad_identifier", "suggested_columns", "hint"} so the
    model can self-correct on its next turn.
    """
    allowed, reason = _safe_select(query)
    if not allowed:
        return json.dumps({"error": reason})
    try:
        rows = con.execute(query).fetchmany(MAX_SQL_ROWS)
        cols = [d[0] for d in con.description]
        return json.dumps([dict(zip(cols, r)) for r in rows], default=str)
    except Exception as exc:  # noqa: BLE001
        return json.dumps(_suggest_fix(str(exc)))


if __name__ == "__main__":
    mcp.run(transport="stdio")
