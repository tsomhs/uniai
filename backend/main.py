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

Response contract
-----------------
  {
    "reply":      string,          # human-readable summary
    "components": Component[],     # rich dashboard spec (see SYSTEM_PROMPT)
    "chartType":  string | null,   # mirrors components[0].type (legacy compat)
    "chartData":  Row[] | null,    # mirrors components[0].data  (legacy compat)
    "session_id": string           # echo back so the client can pin follow-ups
  }
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import AzureOpenAI

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

import config

config.validate()

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

- kpi    : a single number with a known target threshold
- pie    : 2–6 categories summing to a whole (language split, outcome share)
- bar    : ranked categorical data (top intents, breakdown by segment)
- line   : continuous time axis (daily/weekly volume or metric trend)
- area   : stacked or cumulative trend
- table  : >12 rows where comparison matters more than visual ranking

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

## Output contract — emit ONLY this raw JSON, no prose, no markdown fence

{
  "reply": "<one or two sentences for a human reader>",
  "components": [
    {
      "type": "kpi" | "bar" | "line" | "pie" | "area" | "table",
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
      "explanation": "<one sentence: why this chart type>",
      "sql": "<the exact SQL executed>"
    }
  ],
  "chartType": "<type of first component, or null>",
  "chartData": [ <data array of first component, or null> ]
}

Data shapes per type:
  kpi   → [{"name": "<label>", "value": <number>}]          (single row)
  bar   → [{"name": "<category>", "value": <number>}, ...]  (sorted desc)
  pie   → [{"name": "<category>", "value": <number>}, ...]
  line  → [{"name": "<date>", "value": <number>}, ...]       (chronological)
  area  → same as line; add extra numeric keys for stacked series
  table → [{"<col>": <val>, ...}, ...]                       (free-form)

Always use the keys `name` and `value` for the primary series — the existing
frontend depends on them.

Hard rules:
- Read-only SQL only (MCP server rejects writes).
- Never invent column names — call get_table_schema first if unsure.
- Never hard-code lookup tables — read from the views.
- If the user asks for a specific breakdown (by region, by intent), honour it.
- Final answer is JSON only — no ```json fence, no commentary outside the JSON.
"""

# ---------------------------------------------------------------------------
# Session memory — keyed by session_id, stores trimmed message history so
# follow-up questions have context without repeating schema tool calls.
# ---------------------------------------------------------------------------

SESSIONS: dict[str, list[dict[str, Any]]] = {}


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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(..., description="Natural-language question about the data.")
    session_id: str | None = Field(
        default=None,
        description="Opaque session id for conversation continuity. "
                    "If omitted a new id is generated and returned.",
    )


# ---------------------------------------------------------------------------
# MCP helpers
# ---------------------------------------------------------------------------

@asynccontextmanager
async def _mcp_session():
    """Spawn mcp_server.py over stdio and yield an initialised ClientSession."""
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(config.BACKEND_DIR / "mcp_server.py")],
        env={"PYTHONPATH": str(config.BACKEND_DIR), **__import__("os").environ},
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
# Core chat logic
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


def _ensure_legacy_fields(parsed: dict[str, Any]) -> dict[str, Any]:
    """Backfill chartType/chartData from components[0] for frontend compatibility."""
    components = parsed.get("components") or []
    if not parsed.get("chartType") and components:
        parsed["chartType"] = components[0].get("type")
        parsed["chartData"] = components[0].get("data")
    if "chartType" not in parsed:
        parsed["chartType"] = None
        parsed["chartData"] = None
    if "reply" not in parsed:
        parsed["reply"] = ""
    return parsed


async def _run_chat(message: str, session_id: str) -> dict[str, Any]:
    history = list(SESSIONS.get(session_id, []))
    history.append({"role": "user", "content": message})

    messages: list[dict[str, Any]] = (
        [{"role": "system", "content": SYSTEM_PROMPT}] + history
    )

    async with _mcp_session() as mcp:
        for _ in range(config.MAX_TOOL_ITERATIONS):
            completion = await asyncio.to_thread(
                aoai.chat.completions.create,
                model=config.AZURE_DEPLOYMENT,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
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
                raw = _strip_fence(msg.content or "")
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = {
                        "reply": msg.content or "(empty response)",
                        "components": [],
                        "chartType": None,
                        "chartData": None,
                    }
                parsed = _ensure_legacy_fields(parsed)

                # Persist only the user + final assistant turn so follow-ups
                # have natural context without bloating history with tool calls.
                history.append({"role": "assistant",
                                "content": parsed.get("reply", "")})
                SESSIONS[session_id] = history[-(config.MAX_SESSION_HISTORY * 2):]
                return parsed

            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                print(f"  tool → {tc.function.name}({list(args.keys())})")
                output = await _call_tool(mcp, tc.function.name, args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": output,
                })

    return {
        "reply": "The model did not converge within the allowed tool-call budget.",
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
    }


@app.post("/api/chat", tags=["chat"])
async def chat_endpoint(request: ChatRequest) -> dict[str, Any]:
    session_id = request.session_id or uuid.uuid4().hex
    try:
        result = await _run_chat(request.message, session_id)
    except Exception as exc:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    result["session_id"] = session_id
    return result


@app.post("/api/session/reset", tags=["chat"])
async def reset_session(session_id: str) -> dict[str, Any]:
    """Clear conversation history for a given session."""
    SESSIONS.pop(session_id, None)
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
