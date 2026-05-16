"""
FastAPI backend — natural language → dashboard components.

Pipeline per request
--------------------
1. Spawn an MCP server (mcp_server.py) over stdio that exposes six read-only
   tools against backend/data/conversations.duckdb.
2. AzureOpenAI plans the answer via tool calling: reads the metrics dictionary
   and schema, emits one SQL call per chart component, then shapes the result
   into a dashboard-component spec.
3. Conversation memory is keyed by session_id so follow-up questions build on
   prior context without repeating schema lookups.

Streaming
---------
POST /api/chat/stream emits Server-Sent Events while the model works:
  {"type": "progress", "message": "<human-readable step>"}
  {"type": "result",   ...full response fields..., "session_id": "..."}
  {"type": "error",    "message": "<error text>"}
  data: [DONE]

Response contract  (non-streaming /api/chat and the "result" SSE event)
-----------------------------------------------------------------------
  {
    "reply":      string,
    "components": Component[],
    "chartType":  string | null,
    "chartData":  Row[] | null,
    "session_id": string
  }
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Any, Literal, Optional

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError, field_validator
from openai import AzureOpenAI

from fastapi import File, Form, UploadFile

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

import config
import datasource as ds_registry

config.validate()

# ---------------------------------------------------------------------------
# Logging — structured, with session-id prefixes for tracing
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("uniai.main")

# ---------------------------------------------------------------------------
# Azure OpenAI client
# ---------------------------------------------------------------------------

aoai = AzureOpenAI(
    api_key=config.AZURE_OPENAI_KEY,
    api_version=config.AZURE_API_VERSION,
    azure_endpoint=config.AZURE_ENDPOINT,
)

# ---------------------------------------------------------------------------
# OpenAI tool schemas — mirror the MCP tools 1:1 so the model knows the
# calling convention. The MCP server is the authoritative implementation.
# ---------------------------------------------------------------------------

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_tables",
            "description": "List all tables and views in the DuckDB database. "
                           "Prefer the v_* views over conversations_raw.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_table_schema",
            "description": "Get the columns and types of a single table or view.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table_name": {
                        "type": "string",
                        "description": "e.g. v_conversations, v_turns, v_evaluations",
                    },
                },
                "required": ["table_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dataset_date_range",
            "description": "Return min/max start_date in v_conversations. "
                           "Use max_date as 'today' for relative-date questions.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metrics_dictionary",
            "description": "Return the canonical metrics dictionary "
                           "(containment, escalation, CSAT, AHT, FCR, etc.). "
                           "Read before computing any KPI.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_schema_dictionary",
            "description": "Return data/schema.md — the column dictionary, "
                           "intent catalog, and flat-view documentation.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_sql",
            "description": "Run a single read-only SELECT/WITH query against DuckDB. "
                           "Returns up to 500 rows as JSON. Shape the result to be "
                           "chart-ready (name/value for categorical, x/y for time-series).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# System prompt — defines the dashboard-component contract the model must emit.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a Data Analyst AI for a banking voicebot operations team. You turn
natural-language questions into ready-to-render DASHBOARD COMPONENTS by
querying a DuckDB database through MCP tools. You never invent data.

## Reasoning loop

1. Call `get_metrics_dictionary` once per session before computing any KPI.
   It defines containment rate, escalation rate, CSAT, AHT, FCR, and every
   other metric canonically — use those formulas exactly.
2. Call `get_dataset_date_range` when the user uses relative time
   ("this week", "yesterday", "last 30 days", "this month"). The data is
   frozen: `max_date` is the dataset's "today".
3. Call `get_table_schema` before querying a view you're not yet sure of.
   Available flat views:
     v_conversations   one row per call — start_date, segment, region,
                       csat_score, outcome, call_successful, termination_reason,
                       bot_version, main_language, cost_amount, call_duration_secs
     v_turns           one row per turn — role, detected_intent, sentiment,
                       turn_number (use to find first user intent)
     v_evaluations     one row per (call × criterion_id) — result ∈ success/failure/unknown
     v_data_collection one row per (call × field_id) — segment, region, auth_method, etc.
     v_tool_calls      one row per tool invocation — tool_name, success, latency_ms
4. For each chart, emit one `execute_sql` call that already returns chart-ready
   rows. Push GROUP BY / ORDER BY / LIMIT into SQL; do not reshape in your head.

## Choosing chart types

- kpi         : a single number with a known target threshold
- pie         : 2–6 categories summing to a whole (language split, outcome share)
- bar         : ranked categorical data (top intents, breakdown by segment)
- line        : continuous time axis (daily/weekly volume or metric trend)
- area        : stacked or cumulative trend
- table       : >12 rows where comparison matters more than visual ranking
- scatter     : correlation or distribution between two numeric variables
                (e.g. call_duration_secs vs csat_score, cost vs turns)
- heatmap     : intensity of a metric across two categorical dimensions
                (e.g. region × segment volume, day-of-week × hour call count)
- radar       : multi-metric comparison across ONE dimension (e.g. KPI benchmark
                across segments or regions on a spider chart)
- candlestick : period-over-period range data (open/high/low/close) — use when
                the user asks about score ranges, variance, or spread over time

For open-ended questions ("how are we doing this week?"), return MULTIPLE
components — a KPI strip plus 1–2 supporting charts — so the response feels
like a real dashboard, not a single number.

## Threshold & colour rules

Attach a thresholds block to any rate KPI or bar chart so the frontend can
colour values. Use these defaults unless the user specifies otherwise:

  Metric               good    direction          good_color  warn_color
  Containment/Resolut. 0.85    higher_is_better   #7C3AED     #F59E0B
  Escalation           0.10    lower_is_better    #7C3AED     #F59E0B
  Abandonment          0.05    lower_is_better    #7C3AED     #F59E0B
  CSAT                 4.20    higher_is_better   #7C3AED     #F59E0B
  Tool success         0.95    higher_is_better   #7C3AED     #F59E0B

Rate values from SQL are 0–1. Set format.unit="%", format.scale=100,
format.decimals=1 so the frontend renders "76.2%" correctly.

## Suggested follow-up questions

After answering, add 1–3 short follow-up questions in `suggestions` that
naturally deepen the current analysis. Good follow-ups:
- Drill down by a dimension (region, segment, language, bot version)
- Look at the same metric over a different time range
- Compare a related metric (e.g. after containment → escalation or CSAT)
- Surface a ranking or anomaly ("which region has the lowest X?")

Keep each suggestion under 80 characters. Return an empty list only if the
question was purely definitional with no natural follow-on.

## Output contract — emit ONLY this raw JSON, no prose, no markdown fence

{
  "reply": "<one or two sentences for a human reader>",
  "suggestions": ["<follow-up question>", "<follow-up question>"],
  "components": [
    {
      "type": "kpi" | "bar" | "line" | "pie" | "area" | "table"
            | "scatter" | "heatmap" | "radar" | "candlestick",
      "title": "<short, specific title>",
      "subtitle": "<date context, e.g. 'Last 7 days (2026-04-25 → 2026-05-01)'> | null",
      "data": [ ... see per-type shape below ... ],
      "format": {
        "unit": "%" | "" | "s" | "EUR" | null,
        "scale": 1 | 100 | null,
        "decimals": 0 | 1 | 2,
        "thresholds": {
          "good": <number>,
          "direction": "higher_is_better" | "lower_is_better",
          "good_color": "#7C3AED",
          "warn_color": "#F59E0B"
        } | null
      } | null,
      "explanation": "<REQUIRED — one sentence explaining WHY this specific chart type was chosen over alternatives for this data>",
      "sql": "<the exact SQL executed>"
    }
  ],
  "chartType": "<type of first component, or null>",
  "chartData": [ <data array of first component, or null> ]
}

Data shapes per type:
  kpi         → [{"name": "<label>", "value": <number>}]                (single row)
  bar         → [{"name": "<category>", "value": <number>}, ...]        (sorted desc)
  pie         → [{"name": "<category>", "value": <number>}, ...]
  line        → [{"name": "<date>", "value": <number>}, ...]            (chronological)
  area        → same as line; add extra numeric keys for stacked series
  table       → [{"<col>": <val>, ...}, ...]                            (free-form)
  scatter     → [{"name": "<point label>", "x": <number>, "y": <number>}, ...]
  heatmap     → [{"x": "<col-label>", "y": "<row-label>", "value": <number>}, ...]
  radar       → [{"name": "<metric>", "value": <number>}, ...]          (0–100 scale preferred)
  candlestick → [{"name": "<period>", "open": <n>, "high": <n>, "low": <n>, "close": <n>}, ...]

Always use the keys `name` and `value` for the primary series — the existing
frontend depends on them.

Hard rules:
- Read-only SQL only (MCP server rejects writes).
- Never invent column names — call get_table_schema first if unsure.
- Never hard-code lookup tables — read from the views.
- If the user asks for a specific breakdown (by region, by intent), honour it.
- If the user's wording is ambiguous, choose the closest dataset-backed proxy,
  say explicitly that it is a proxy, and name the exact field/intent used.
- Prefer canonical dataset terms over paraphrases. If multiple phrasings map to
  the same dataset concept, answer them consistently.
- For "struggling to use the product/app/e-banking" style questions, prefer a
  digital self-service proxy grounded in the dataset, such as
  `ebanking_login_issue` and `password_reset`, unless the user specifies a
  narrower metric or dimension.
- Final answer is JSON only — no ```json fence, no commentary outside the JSON.
"""

# ── Generic prompt used for any non-default datasource ───────────────────────

SYSTEM_PROMPT_GENERIC = """\
You are a Data Analyst AI. You turn natural-language questions into
DASHBOARD COMPONENTS by querying a user-provided database through MCP tools.
You never invent data.

## Reasoning loop

1. Call `list_tables` to discover what tables are available in this database.
2. Call `get_table_schema` to understand the columns and types of relevant tables.
3. For each chart component, call `execute_sql` with a single chart-ready SELECT.
   Push all aggregation, filtering, ordering, and limiting into SQL.
   Never reshape data in your head.

## Choosing chart types

- kpi         : a single summary number (count, average, sum, rate)
- pie         : 2–6 categories summing to a whole
- bar         : ranked categorical data — sorted descending
- line        : metric plotted over a continuous time axis
- area        : cumulative or stacked trend
- table       : tabular detail with >10 rows or many columns
- scatter     : correlation or distribution between two numeric variables
- heatmap     : intensity across two categorical dimensions (x × y grid)
- radar       : multi-metric comparison for a single entity on a spider chart
- candlestick : open/high/low/close range data per time period

For open-ended questions, return MULTIPLE components (a KPI strip + 1–2 charts).

## Output contract — emit ONLY this raw JSON, no prose, no markdown fence

{
  "reply": "<one or two sentences for a human reader>",
  "suggestions": ["<follow-up question>", "<follow-up question>"],
  "components": [
    {
      "type": "kpi" | "bar" | "line" | "pie" | "area" | "table"
            | "scatter" | "heatmap" | "radar" | "candlestick",
      "title": "<short, specific title>",
      "subtitle": "<filter / time context> | null",
      "data": [ ... ],
      "format": {
        "unit": "%" | "" | "s" | "EUR" | null,
        "scale": 1 | 100 | null,
        "decimals": 0 | 1 | 2,
        "thresholds": null
      } | null,
      "explanation": "<REQUIRED — one sentence explaining WHY this specific chart type was chosen for this data>",
      "sql": "<the exact SQL executed>"
    }
  ],
  "chartType": "<type of first component>",
  "chartData": [ <data array of first component> ]
}

Data shapes per type:
  kpi         → [{"name": "<label>", "value": <number>}]
  bar         → [{"name": "<category>", "value": <number>}, ...]  sorted desc
  pie         → [{"name": "<category>", "value": <number>}, ...]
  line        → [{"name": "<date or label>", "value": <number>}, ...]
  area        → same as line
  table       → [{"<col>": <val>, ...}, ...]
  scatter     → [{"name": "<label>", "x": <number>, "y": <number>}, ...]
  heatmap     → [{"x": "<col-label>", "y": "<row-label>", "value": <number>}, ...]
  radar       → [{"name": "<metric>", "value": <number>}, ...]
  candlestick → [{"name": "<period>", "open": <n>, "high": <n>, "low": <n>, "close": <n>}, ...]

Always use the keys `name` and `value` for the primary series.

Hard rules:
- Read-only SELECT/WITH queries only.
- Never invent column names — call get_table_schema first.
- Final answer is JSON only — no ```json fence, no prose.
"""

# ── Tool schemas for custom datasources (no voicebot-specific tools) ─────────

TOOL_SCHEMAS_GENERIC: list[dict[str, Any]] = [
    TOOL_SCHEMAS[0],   # list_tables
    TOOL_SCHEMAS[1],   # get_table_schema
    TOOL_SCHEMAS[5],   # execute_sql
]

# ---------------------------------------------------------------------------
# Session memory — keyed by session_id, stores trimmed message history so
# follow-up questions have context without repeating schema tool calls.
# ---------------------------------------------------------------------------

MAX_SESSIONS = 500
SESSIONS: dict[str, list[dict[str, Any]]] = {}

# Binds each session_id to the authenticated user that owns it. This prevents
# a user from reading another user's conversation history by guessing or
# replaying their session_id.
SESSION_OWNER: dict[str, str] = {}

# Tracks which datasource each session was last run against so that a
# mid-conversation source switch triggers an automatic context reset.
SESSION_DATASOURCE: dict[str, str] = {}


def _evict_sessions() -> None:
    """FIFO eviction — keep SESSIONS under MAX_SESSIONS."""
    overflow = len(SESSIONS) - MAX_SESSIONS + 1
    if overflow > 0:
        for key in list(SESSIONS)[:overflow]:
            SESSIONS.pop(key, None)
            SESSION_DATASOURCE.pop(key, None)
            SESSION_OWNER.pop(key, None)


def _claim_session(session_id: str | None, user_email: str) -> str:
    """
    Resolve the session_id the caller should use:
      - None or unknown → mint a new one and claim it for this user.
      - Known and owned by user → return as-is.
      - Known and owned by a DIFFERENT user → reject with 403.
    """
    if not session_id:
        sid = uuid.uuid4().hex
        SESSION_OWNER[sid] = user_email
        return sid
    owner = SESSION_OWNER.get(session_id)
    if owner is None:
        SESSION_OWNER[session_id] = user_email
        return session_id
    if owner != user_email:
        raise HTTPException(
            status_code=403,
            detail="This session belongs to another user.",
        )
    return session_id


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Speak-With-Your-Data",
    description="Natural language → dashboard components over a DuckDB voicebot dataset.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth — in-memory user store (resets on restart; fine for hackathon)
# ---------------------------------------------------------------------------

_USERS:  dict[str, dict] = {}   # email  → {name, email, password_hash, salt}
_TOKENS: dict[str, str]  = {}   # token  → email


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _hash_password(salt: str, password: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


@app.post("/api/auth/register")
def auth_register(req: RegisterRequest):
    email = req.email.strip().lower()
    if email in _USERS:
        raise HTTPException(400, "Email already registered")
    salt = secrets.token_hex(16)
    _USERS[email] = {
        "name": req.name.strip(),
        "email": email,
        "password_hash": _hash_password(salt, req.password),
        "salt": salt,
    }
    return {"message": "Account created"}


@app.post("/api/auth/login")
def auth_login(req: LoginRequest, response: Response):
    user = _USERS.get(req.email.strip().lower())
    if not user or _hash_password(user["salt"], req.password) != user["password_hash"]:
        raise HTTPException(401, "Invalid email or password")
    token = secrets.token_hex(32)
    _TOKENS[token] = req.email
    response.set_cookie(
        "session", token, httponly=True, samesite="lax",
        max_age=86400 * 7, path="/",
    )
    return {"name": user["name"], "email": user["email"]}


@app.get("/api/auth/me")
def auth_me(session: Optional[str] = Cookie(None)):
    email = _TOKENS.get(session or "")
    user = _USERS.get(email or "")
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"name": user["name"], "email": user["email"]}


@app.post("/api/auth/logout")
def auth_logout(response: Response, session: Optional[str] = Cookie(None)):
    if session:
        _TOKENS.pop(session, None)
    response.delete_cookie("session", path="/")
    return {"message": "Logged out"}


# ---------------------------------------------------------------------------
# Auth dependency — every protected endpoint reads the session cookie via
# Depends(current_user) and gets the authenticated user's email, or 401.
# ---------------------------------------------------------------------------

def current_user(session: Optional[str] = Cookie(None)) -> str:
    email = _TOKENS.get(session or "")
    if not email or email not in _USERS:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return email


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural-language question about the data.",
    )
    session_id: str | None = Field(
        default=None,
        description="Opaque session id for conversation continuity. "
                    "If omitted a new id is generated and returned.",
    )
    datasource_id: str | None = Field(
        default=None,
        description="Datasource to query. Defaults to the voicebot conversations dataset.",
    )

    @field_validator("message", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class PostgresConnectRequest(BaseModel):
    host:         str        = Field(..., description="PostgreSQL host.")
    port:         int        = Field(default=5432)
    database:     str        = Field(..., description="Database name.")
    user:         str        = Field(..., description="Username.")
    password:     str        = Field(..., description="Password.")
    tables:       list[str]  = Field(..., description="Tables to snapshot (e.g. ['public.orders']).")
    display_name: str        = Field(default="", description="Label shown in the UI.")


# ---------------------------------------------------------------------------
# MCP helpers
# ---------------------------------------------------------------------------

@asynccontextmanager
async def _mcp_session(db_path: str | None = None):
    """Spawn mcp_server.py over stdio and yield an initialised ClientSession.

    Pass db_path to override the default conversations.duckdb — used for
    custom datasources (uploads, postgres snapshots, sqlite snapshots).
    """
    env: dict[str, str] = {"PYTHONPATH": str(config.BACKEND_DIR), **os.environ}
    if db_path:
        env["UNIAI_DB_PATH"] = db_path
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(config.BACKEND_DIR / "mcp_server.py")],
        env=env,
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def _call_tool(session: ClientSession, name: str, args: dict[str, Any]) -> str:
    result = await session.call_tool(name, arguments=args)
    if not result.content:
        return json.dumps({"error": "MCP tool returned no content"})
    chunk = result.content[0]
    return getattr(chunk, "text", str(chunk))


# ---------------------------------------------------------------------------
# Human-readable progress messages per tool call
# ---------------------------------------------------------------------------

def _tool_progress_message(tool_name: str, args: dict[str, Any]) -> str:
    """Map an MCP tool invocation to a user-facing progress description."""
    if tool_name == "get_metrics_dictionary":
        return "Reading metric definitions…"
    if tool_name == "get_dataset_date_range":
        return "Checking available data date range…"
    if tool_name == "get_schema_dictionary":
        return "Reading data dictionary…"
    if tool_name == "list_tables":
        return "Discovering available data tables…"
    if tool_name == "get_table_schema":
        table = args.get("table_name", "")
        label = {
            "v_conversations": "call records",
            "v_turns": "conversation turns",
            "v_evaluations": "call evaluations",
            "v_data_collection": "collected data fields",
            "v_tool_calls": "bot tool calls",
        }.get(table, (table.replace("v_", "").replace("_", " ") or "data"))
        return f"Inspecting {label} structure…"
    if tool_name == "execute_sql":
        q = (args.get("query") or "").upper()
        if any(k in q for k in ("WEEK", "MONTH", "DATE_TRUNC", "STRFTIME", "STRPTIME")):
            return "Aggregating data over time…"
        if "GROUP BY" in q and any(k in q for k in ("INTENT", "DETECTED_INTENT")):
            return "Analysing intent distribution…"
        if "GROUP BY" in q and any(k in q for k in ("REGION", "SEGMENT", "LANGUAGE", "BOT_VERSION")):
            return "Grouping records by dimension…"
        if "GROUP BY" in q:
            return "Grouping and counting records…"
        if "AVG(" in q:
            return "Computing average metrics…"
        if "COUNT(" in q:
            return "Counting conversation records…"
        return "Querying conversation records…"
    return f"Running {tool_name.replace('_', ' ')}…"


# ---------------------------------------------------------------------------
# Core chat logic — async generator yielding (event_type, payload) tuples
# ---------------------------------------------------------------------------

def _strip_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        newline = t.find("\n")
        if newline != -1:
            t = t[newline + 1:]
        if t.endswith("```"):
            t = t[:-3]
    return t.strip()


# ---------------------------------------------------------------------------
# Component validation — the LLM is told what shape each component type
# must have, but it occasionally drifts. Validating each component against
# a typed Pydantic model lets us drop malformed ones BEFORE they reach the
# frontend (where a scatter without x/y, or a candlestick without OHLC,
# would silently break the chart). Invalid components are reported back in
# `_validation_warnings` so the user can see what was filtered.
# ---------------------------------------------------------------------------

class _NameValueRow(BaseModel):
    name: str
    value: float


class _XYRow(BaseModel):
    name: Optional[str] = None
    x: float
    y: float


class _HeatmapRow(BaseModel):
    x: str
    y: str
    value: float


class _OHLCRow(BaseModel):
    name: str
    open:  float
    high:  float
    low:   float
    close: float


class _ComponentBase(BaseModel):
    model_config = {"extra": "allow"}
    title: str = ""
    subtitle: Optional[str] = None


class _KpiComp(_ComponentBase):
    type: Literal["kpi"]
    data: list[_NameValueRow] = Field(min_length=1)


class _BarComp(_ComponentBase):
    type: Literal["bar"]
    data: list[_NameValueRow] = Field(min_length=1)


class _PieComp(_ComponentBase):
    type: Literal["pie"]
    data: list[_NameValueRow] = Field(min_length=1)


class _LineComp(_ComponentBase):
    type: Literal["line"]
    data: list[_NameValueRow] = Field(min_length=1)


class _AreaComp(_ComponentBase):
    type: Literal["area"]
    data: list[_NameValueRow] = Field(min_length=1)


class _TableComp(_ComponentBase):
    type: Literal["table"]
    data: list[dict[str, Any]] = Field(min_length=1)


class _ScatterComp(_ComponentBase):
    type: Literal["scatter"]
    data: list[_XYRow] = Field(min_length=1)


class _HeatmapComp(_ComponentBase):
    type: Literal["heatmap"]
    data: list[_HeatmapRow] = Field(min_length=1)


class _RadarComp(_ComponentBase):
    type: Literal["radar"]
    data: list[_NameValueRow] = Field(min_length=1)


class _CandlestickComp(_ComponentBase):
    type: Literal["candlestick"]
    data: list[_OHLCRow] = Field(min_length=1)


_COMPONENT_MODELS: dict[str, type[BaseModel]] = {
    "kpi":         _KpiComp,
    "bar":         _BarComp,
    "pie":         _PieComp,
    "line":        _LineComp,
    "area":        _AreaComp,
    "table":       _TableComp,
    "scatter":     _ScatterComp,
    "heatmap":     _HeatmapComp,
    "radar":       _RadarComp,
    "candlestick": _CandlestickComp,
}


def _validate_components(parsed: dict[str, Any]) -> dict[str, Any]:
    """
    Drop components whose `data` doesn't match the documented shape for
    their `type`. Surviving components pass through unchanged (extra fields
    like `explanation`, `sql`, `format` are preserved).

    Warnings about dropped components are attached to `_validation_warnings`
    so they can be logged and (optionally) shown to the user.
    """
    raw_components = parsed.get("components") or []
    valid:    list[dict[str, Any]] = []
    warnings: list[str]            = []

    for i, comp in enumerate(raw_components, start=1):
        if not isinstance(comp, dict):
            warnings.append(f"Component #{i}: not an object.")
            continue

        ctype = comp.get("type")
        model = _COMPONENT_MODELS.get(ctype)
        if model is None:
            warnings.append(f"Component #{i}: unknown type '{ctype}'.")
            continue

        try:
            model.model_validate(comp)
        except ValidationError as exc:
            first = exc.errors()[0] if exc.errors() else {}
            loc   = ".".join(str(x) for x in first.get("loc", ()))
            msg   = first.get("msg", "validation failed")
            warnings.append(f"Component #{i} ({ctype}): {loc} — {msg}")
            continue

        valid.append(comp)

    parsed["components"] = valid
    if warnings:
        parsed["_validation_warnings"] = warnings
        logger.warning("Dropped %d malformed component(s): %s",
                       len(warnings), "; ".join(warnings))
    return parsed


def _ensure_legacy_fields(parsed: dict[str, Any]) -> dict[str, Any]:
    """Backfill chartType/chartData from components[0] for frontend compatibility."""
    components = parsed.get("components") or []
    if not parsed.get("chartType") and components:
        parsed["chartType"] = components[0].get("type")
        parsed["chartData"] = components[0].get("data")
    parsed.setdefault("chartType", None)
    parsed.setdefault("chartData", None)
    parsed.setdefault("reply", "")
    parsed.setdefault("suggestions", [])
    return parsed


def _compact_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _default_dataset_hint(message: str) -> str | None:
    """Return a deterministic dataset-grounding hint for ambiguous phrasing."""
    text = _compact_ws(message)
    hints: list[str] = []

    if any(
        phrase in text
        for phrase in (
            "don't know how to use the product",
            "dont know how to use the product",
            "do not know how to use the product",
            "don't know how to use the app",
            "dont know how to use the app",
            "do not know how to use the app",
            "don't know how to use e-banking",
            "dont know how to use e-banking",
            "do not know how to use e-banking",
            "struggle to use the product",
            "struggling to use the product",
            "struggle to use the app",
            "struggling to use the app",
            "can't use the app",
            "cant use the app",
            "cannot use the app",
            "unable to use the app",
            "can't use e-banking",
            "cant use e-banking",
            "cannot use e-banking",
            "unable to use e-banking",
        )
    ):
        hints.append(
            "Interpret 'difficulty using the product/app/e-banking' as a proxy, "
            "not a literal label. Prefer first-intent counts for "
            "`ebanking_login_issue` and `password_reset`, and say that proxy "
            "explicitly in the reply."
        )

    if "frustrat" in text or "angry" in text or "upset" in text:
        hints.append(
            "For emotional phrasing, prefer explicit dataset signals like "
            "`complaint_detected=true` or `sentiment='negative'`, and name which "
            "signal you used."
        )

    if ("drop" in text or "leave" in text or "quit" in text) and "call" in text:
        hints.append(
            "Map caller drop-off wording to dataset-backed abandonment signals "
            "such as `termination_reason='caller_hung_up'` or `outcome='abandoned'`, "
            "and state the chosen definition."
        )

    if "success" in text and "resolved" not in text and "contain" not in text:
        hints.append(
            "Do not treat generic 'success' as a free-form concept. Prefer the "
            "canonical KPI definitions from the metrics dictionary or named fields "
            "such as `call_successful` / `intent_resolved`."
        )

    if not hints:
        return None

    return "Dataset interpretation hints:\n- " + "\n- ".join(hints)


def _build_prompt_messages(
    message: str,
    history: list[dict[str, Any]],
    system_prompt: str,
    *,
    is_default: bool,
) -> list[dict[str, Any]]:
    """Assemble model messages with deterministic dataset-grounding hints."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if is_default:
        hint = _default_dataset_hint(message)
        if hint:
            messages.append({"role": "system", "content": hint})
    messages.extend(history)
    messages.append({"role": "user", "content": message})
    return messages


async def _run_chat_stream(
    message:       str,
    session_id:    str,
    datasource_id: str = "default",
    user_email:    str | None = None,
):
    """
    Async generator — yields ("progress", {message}) for each reasoning step
    and finally ("result", {full response dict}).

    Selects the system prompt and tool schema based on whether the active
    datasource is the default voicebot dataset or a custom user datasource.

    Datasource access is scoped to `user_email`: only the default dataset
    or datasources owned by this user are reachable.
    """
    ds = ds_registry.get(datasource_id, owner_email=user_email)
    if ds is None:
        # Either the id is unknown or it belongs to another user — in both
        # cases we silently fall back to the public default so the user
        # gets a sensible answer instead of an internal error.
        ds = ds_registry.get("default")
    is_default = ds.get("is_default", False)

    system_prompt = SYSTEM_PROMPT if is_default else SYSTEM_PROMPT_GENERIC
    tool_schemas  = TOOL_SCHEMAS  if is_default else TOOL_SCHEMAS_GENERIC
    db_path       = None          if is_default else ds["db_path"]

    # Auto-reset stale schema context when the datasource changes mid-conversation.
    previous_ds_id = SESSION_DATASOURCE.get(session_id)
    if previous_ds_id is not None and previous_ds_id != ds["id"]:
        logger.info(
            "[%s] datasource switched %s → %s — resetting session context",
            session_id[:8], previous_ds_id[:8], ds["id"][:8],
        )
        SESSIONS.pop(session_id, None)
    SESSION_DATASOURCE[session_id] = ds["id"]

    history = list(SESSIONS.get(session_id, []))
    messages: list[dict[str, Any]] = _build_prompt_messages(
        message,
        history,
        system_prompt,
        is_default=is_default,
    )

    yield "progress", {"message": "Analysing your question…"}

    async with _mcp_session(db_path=db_path) as mcp:
        for _ in range(config.MAX_TOOL_ITERATIONS):
            completion = await asyncio.to_thread(
                aoai.chat.completions.create,
                model=config.AZURE_DEPLOYMENT,
                messages=messages,
                tools=tool_schemas,
                tool_choice="auto",
                temperature=0,
                max_completion_tokens=16384,
            )
            choice = completion.choices[0]
            msg = choice.message

            assistant_entry: dict[str, Any] = {
                "role": "assistant",
                "content": msg.content or "",
            }
            if msg.tool_calls:
                assistant_entry["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ]
            messages.append(assistant_entry)

            if not msg.tool_calls:
                yield "progress", {"message": "Building your dashboard…"}

                raw = _strip_fence(msg.content or "")
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = {
                        "reply": msg.content or "(empty response)",
                        "components": [],
                    }
                parsed = _validate_components(parsed)
                parsed = _ensure_legacy_fields(parsed)

                history.append({"role": "user", "content": message})
                history.append({
                    "role": "assistant",
                    "content": parsed.get("reply", ""),
                })
                if session_id not in SESSIONS:
                    _evict_sessions()
                SESSIONS[session_id] = history[-(config.MAX_SESSION_HISTORY * 2):]

                yield "result", parsed
                return

            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}

                progress_msg = _tool_progress_message(tc.function.name, args)
                logger.info(
                    "[%s] tool → %s  args=%s",
                    session_id[:8], tc.function.name, list(args.keys()),
                )
                yield "progress", {"message": progress_msg}

                output = await _call_tool(mcp, tc.function.name, args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": output,
                })

    yield "result", {
        "reply": "The model did not converge within the allowed tool-call budget.",
        "components": [],
        "chartType": None,
        "chartData": None,
    }


async def _run_chat(
    message:       str,
    session_id:    str,
    datasource_id: str = "default",
    user_email:    str | None = None,
) -> dict[str, Any]:
    """Non-streaming wrapper — collects the final result from _run_chat_stream."""
    async for event_type, payload in _run_chat_stream(
        message, session_id, datasource_id, user_email=user_email,
    ):
        if event_type == "result":
            return payload
    return {
        "reply": "No result produced.",
        "components": [],
        "chartType": None,
        "chartData": None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["ops"])
async def health() -> dict[str, Any]:
    """Liveness probe — returns deployment name so callers can verify config."""
    return {
        "ok": True,
        "deployment": config.AZURE_DEPLOYMENT,
        "db": str(config.DB_PATH),
        "active_sessions": len(SESSIONS),
    }


@app.post("/api/chat/stream", tags=["chat"])
async def chat_stream(
    request: ChatRequest,
    user:    str = Depends(current_user),
) -> StreamingResponse:
    """
    SSE endpoint — streams progress events then the final dashboard result.
    Clients should prefer this over /api/chat for real-time feedback.
    """
    session_id    = _claim_session(request.session_id, user)
    datasource_id = request.datasource_id or "default"
    logger.info(
        "[%s] stream request user=%s ds=%s: %.80s",
        session_id[:8], user, datasource_id, request.message,
    )

    async def event_generator():
        try:
            async for event_type, payload in _run_chat_stream(
                request.message, session_id, datasource_id, user_email=user,
            ):
                if event_type == "result":
                    payload["session_id"] = session_id
                data = json.dumps({"type": event_type, **payload})
                yield f"data: {data}\n\n"
        except Exception as exc:
            logger.exception("[%s] stream error", session_id[:8])
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/chat", tags=["chat"])
async def chat_endpoint(
    request: ChatRequest,
    user:    str = Depends(current_user),
) -> dict[str, Any]:
    """Non-streaming JSON endpoint (backwards compatibility)."""
    session_id    = _claim_session(request.session_id, user)
    datasource_id = request.datasource_id or "default"
    logger.info(
        "[%s] chat request user=%s ds=%s: %.80s",
        session_id[:8], user, datasource_id, request.message,
    )
    try:
        result = await _run_chat(
            request.message, session_id, datasource_id, user_email=user,
        )
    except Exception as exc:
        logger.exception("[%s] chat error", session_id[:8])
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    result["session_id"] = session_id
    return result


# ---------------------------------------------------------------------------
# Datasource routes
# ---------------------------------------------------------------------------

@app.get("/api/datasource", tags=["datasource"])
async def list_datasources(
    user: str = Depends(current_user),
) -> list[dict[str, Any]]:
    """List the default datasource plus any custom ones owned by this user."""
    return ds_registry.list_all(owner_email=user)


@app.post("/api/datasource/upload", tags=["datasource"])
async def upload_datasource(
    file:         UploadFile = File(...),
    display_name: str        = Form(default=""),
    user:         str        = Depends(current_user),
) -> dict[str, Any]:
    """
    Upload a CSV, JSON, or JSONL file and register it as a queryable datasource.
    The file is imported into an isolated DuckDB file; the upload is discarded.
    Max 100 MB.
    """
    file_bytes = await file.read()
    try:
        ds = await asyncio.to_thread(
            ds_registry.ingest_file,
            file_bytes, file.filename or "upload", display_name,
            user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("File ingestion failed: %s", file.filename)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ds


@app.post("/api/datasource/connect/postgres", tags=["datasource"])
async def connect_postgres(
    request: PostgresConnectRequest,
    user:    str = Depends(current_user),
) -> dict[str, Any]:
    """
    Snapshot selected PostgreSQL tables into a local DuckDB datasource.
    Requires the duckdb postgres extension (auto-downloaded on first use).
    """
    try:
        ds = await asyncio.to_thread(
            ds_registry.connect_postgres,
            request.host, request.port, request.database,
            request.user, request.password,
            request.tables, request.display_name,
            user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Postgres connect failed: %s@%s", request.database, request.host)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ds


@app.post("/api/datasource/connect/sqlite", tags=["datasource"])
async def connect_sqlite(
    file:         UploadFile = File(...),
    display_name: str        = Form(default=""),
    user:         str        = Depends(current_user),
) -> dict[str, Any]:
    """
    Upload a SQLite (.db / .sqlite) file and snapshot all its tables into DuckDB.
    Requires the duckdb sqlite extension (auto-downloaded on first use).
    """
    file_bytes = await file.read()
    try:
        ds = await asyncio.to_thread(
            ds_registry.connect_sqlite, file_bytes,
            file.filename or "database.db", display_name,
            user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("SQLite connect failed: %s", file.filename)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ds


@app.delete("/api/datasource/{ds_id}", tags=["datasource"])
async def delete_datasource(
    ds_id: str,
    user:  str = Depends(current_user),
) -> dict[str, Any]:
    """Remove a custom datasource (owned by this user) and delete its file."""
    if ds_id == "default":
        raise HTTPException(status_code=400, detail="Cannot remove the default datasource.")
    removed = ds_registry.remove(ds_id, owner_email=user)
    if not removed:
        # 404 (not 403) so we don't leak the existence of someone else's datasource.
        raise HTTPException(status_code=404, detail=f"Datasource '{ds_id}' not found.")
    return {"ok": True}


@app.post("/api/session/reset", tags=["chat"])
async def reset_session(
    session_id: str,
    user:       str = Depends(current_user),
) -> dict[str, Any]:
    """Clear conversation history for a given session (must be owned by user)."""
    owner = SESSION_OWNER.get(session_id)
    if owner and owner != user:
        # Don't leak whether the session exists — pretend it didn't.
        return {"ok": True}
    SESSIONS.pop(session_id, None)
    SESSION_DATASOURCE.pop(session_id, None)
    SESSION_OWNER.pop(session_id, None)
    logger.info("[%s] session reset by %s", session_id[:8], user)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
