"""
FastAPI backend that turns natural-language questions about the banking
voicebot dataset into dashboard components.

Pipeline
--------
1. Spawn an MCP server (mcp_server.py) over stdio that exposes read-only
   tools against `conversations.duckdb`.
2. AzureOpenAI (gpt-5.4-2 deployment) plans the answer: reads the metrics
   dictionary, inspects the schema, emits one SQL query per component, then
   shapes the result into a dashboard-component spec.
3. Conversation memory is keyed by `session_id` so follow-up questions reuse
   prior context.

The response payload is intentionally backwards-compatible with the existing
frontend (`reply` / `chartType` / `chartData`) AND includes a richer
`components` array for a future, dashboard-aware UI.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from openai import AzureOpenAI

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()

# ---------------------------------------------------------------------------
# Azure OpenAI
# ---------------------------------------------------------------------------

AZURE_ENDPOINT = "https://naoum-mordj9zw-eastus2.cognitiveservices.azure.com/"
AZURE_DEPLOYMENT = "gpt-5.4-2"
AZURE_API_VERSION = "2024-12-01-preview"

if not os.getenv("AZURE_OPENAI_KEY"):
    print("WARNING: AZURE_OPENAI_KEY is not set. /api/chat will fail.",
          file=sys.stderr)

aoai = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY", ""),
    api_version=AZURE_API_VERSION,
    azure_endpoint=AZURE_ENDPOINT,
)

# ---------------------------------------------------------------------------
# OpenAI-style tool schemas — these mirror the MCP tools 1:1. The MCP server
# is the authoritative implementation; this block just tells the model what
# tools exist and how to call them.
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
                        "description": "Name of the table or view, e.g. v_conversations.",
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
            "description": "Return min/max start_date in v_conversations. The "
                           "max date is the dataset's 'today' — use it to "
                           "resolve relative dates like 'this week'.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metrics_dictionary",
            "description": "Return the canonical metrics dictionary "
                           "(containment, escalation, CSAT, AHT, FCR, etc.). "
                           "Read before computing any KPI so every team uses "
                           "the same formula.",
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
            "description": "Run a single read-only SELECT/WITH query against "
                           "DuckDB. Returns up to 500 rows as JSON.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Read-only SQL. Shape the SELECT so the "
                                       "result is already chart-ready "
                                       "(label/value, or x/y for time series).",
                    },
                },
                "required": ["query"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# System prompt — the dashboard-component contract lives here.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a Data Analyst AI for a banking voicebot. You turn natural-language
questions into ready-to-render DASHBOARD COMPONENTS by querying a DuckDB
database through MCP tools. You never invent data.

## Your loop

1. If you haven't yet this session, call `get_metrics_dictionary` once — it is
   the canonical definition of every KPI (containment, escalation, CSAT,
   AHT, FCR, tool success, etc.). Use those formulas verbatim.
2. Call `get_dataset_date_range` when the user uses relative time
   ("this week", "yesterday", "last 30 days"). The dataset is synthetic and
   frozen — `max_date` is "today" for our purposes.
3. Call `get_table_schema` before you write SQL against a view you're not
   already sure of. Prefer the flat views:
     - `v_conversations`  : one row per call (start_date, segment, region,
                            csat_score, outcome, call_successful,
                            termination_reason, bot_version, main_language)
     - `v_turns`          : one row per turn (role, detected_intent, sentiment,
                            turn_number)
     - `v_evaluations`    : one row per (call x criterion)
     - `v_data_collection`: one row per (call x extracted field)
     - `v_tool_calls`     : one row per tool invocation (tool_name, success,
                            latency_ms)
4. For each chart you'll return, emit ONE `execute_sql` call that already
   shapes the result for that chart. Don't post-process in your head — push
   the GROUP BY / ORDER BY / LIMIT into SQL.
5. Compose the final JSON dashboard answer.

## Chart-type rules of thumb

- `kpi`      : a single number ("containment rate this week"). Add a threshold.
- `pie`      : 2-6 categorical buckets summing to a whole (language split).
- `bar`      : ranked categorical (top N intents, breakdown by segment).
- `line`     : a continuous time axis (daily volume).
- `area`     : stacked / cumulative trend.
- `table`    : >12 rows where comparison matters more than visual ranking.

If the user asks an open-ended "how are we doing this week?" style question,
return MULTIPLE components (a KPI strip + 1-2 charts) — that's what makes the
output feel like a real dashboard.

## Thresholds & color formatting

When a KPI has a known operational threshold, attach a `thresholds` object so
the frontend can color the value. Use these defaults unless the user overrides:

| Metric                  | good     | direction          | good_color | warn_color |
|-------------------------|----------|--------------------|------------|------------|
| Containment / Resolution| 0.85     | higher_is_better   | #7C3AED    | #F59E0B    |
| Escalation              | 0.10     | lower_is_better    | #7C3AED    | #F59E0B    |
| Abandonment             | 0.05     | lower_is_better    | #7C3AED    | #F59E0B    |
| CSAT                    | 4.2      | higher_is_better   | #7C3AED    | #F59E0B    |
| Tool success            | 0.95     | higher_is_better   | #7C3AED    | #F59E0B    |

Rate metrics (containment etc.) are 0-1 in SQL — set `format.unit = "%"` and
`format.scale = 100` so the frontend renders "76.2%".

## Output contract

Your FINAL message MUST be a single raw JSON object — no prose, no markdown
fence — with this exact shape:

{
  "reply": "<one or two short sentences for a human reader>",
  "components": [
    {
      "type": "kpi" | "bar" | "line" | "pie" | "area" | "table",
      "title": "<short, specific>",
      "subtitle": "<context, e.g. 'Last 7 days (2026-04-25 -> 2026-05-01)'> | null",
      "data": [ ... see per-type shape below ... ],
      "format": {
        "unit": "%" | "" | "s" | "EUR" | null,
        "scale": 1 | 100 | null,
        "decimals": 0 | 1 | 2,
        "thresholds": {
          "good": <number>, "direction": "higher_is_better"|"lower_is_better",
          "good_color": "#7C3AED", "warn_color": "#F59E0B"
        } | null
      } | null,
      "explanation": "<why this chart type was chosen, 1 sentence>",
      "sql": "<the exact SQL you ran>"
    }
  ],
  "chartType": "bar"|"line"|"pie"|"kpi"|"area"|"table"|null,
  "chartData": [{"name": "...", "value": ...}, ...] | null
}

`chartType` and `chartData` MIRROR the first component for backwards
compatibility with the existing frontend. If the first component is a KPI,
set `chartType` to "kpi" and `chartData` to `[{"name": title, "value": value}]`.

## Per-type data shape

- kpi     : [{"name": "<label>", "value": <number>}]                       (one row)
- bar     : [{"name": "<category>", "value": <number>}, ...]               (sorted desc)
- pie     : [{"name": "<category>", "value": <number>}, ...]
- line    : [{"name": "<date or label>", "value": <number>}, ...]          (chronological)
- area    : same as line, plus optional extra numeric keys for stacked series
- table   : [{"<col1>": ..., "<col2>": ...}, ...]                          (free-form)

Always use the keys `name` and `value` for the headline series — the existing
frontend depends on them.

## Hard rules

- Read-only SQL. The MCP server will reject writes anyway.
- Don't invent columns. If you're unsure, call `get_table_schema` first.
- Don't hard-code lookup tables — read from the views.
- Don't truncate the user's question. If they asked for "by region", group by
  region, not by segment.
- Your final answer is JSON only — no ```json fence, no commentary.
"""

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Speak-With-Your-Data Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-session conversation history. Keyed by session_id. Each value is a list
# of OpenAI chat messages (system message is NOT stored — we prepend it on
# every call so prompt edits take effect immediately).
SESSIONS: dict[str, list[dict[str, Any]]] = {}
MAX_HISTORY = 16  # user/assistant turns before we start trimming


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = Field(
        default=None,
        description="Opaque session id. If omitted, a new one is generated and "
                    "returned in the response so the client can pin follow-ups.",
    )


@asynccontextmanager
async def _mcp_session():
    """Spawn the MCP server over stdio and yield an initialized ClientSession."""
    base_dir = Path(__file__).resolve().parent
    mcp_script = base_dir / "mcp_server.py"
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(mcp_script)],
        env=os.environ.copy(),
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def _call_mcp_tool(session: ClientSession, name: str, args: dict[str, Any]) -> str:
    """Call an MCP tool and return its first text chunk."""
    result = await session.call_tool(name, arguments=args)
    if not result.content:
        return json.dumps({"error": "MCP tool returned no content"})
    chunk = result.content[0]
    return getattr(chunk, "text", str(chunk))


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        # ```json ... ``` or ``` ... ```
        first_newline = t.find("\n")
        if first_newline != -1:
            t = t[first_newline + 1:]
        if t.endswith("```"):
            t = t[:-3]
    return t.strip()


def _legacy_compat(parsed: dict[str, Any]) -> dict[str, Any]:
    """Backfill chartType/chartData from components[0] if the model forgot."""
    components = parsed.get("components") or []
    if "chartType" not in parsed or parsed.get("chartType") is None:
        if components:
            first = components[0]
            parsed["chartType"] = first.get("type")
            parsed["chartData"] = first.get("data")
        else:
            parsed["chartType"] = None
            parsed["chartData"] = None
    if "reply" not in parsed:
        parsed["reply"] = ""
    return parsed


async def _run_chat(user_message: str, session_id: str) -> dict[str, Any]:
    history = SESSIONS.get(session_id, [])
    history = history + [{"role": "user", "content": user_message}]

    async with _mcp_session() as mcp_session:
        # Tool-calling loop. We don't cap iterations tightly — most questions
        # converge in 3-6 tool calls.
        messages: list[dict[str, Any]] = (
            [{"role": "system", "content": SYSTEM_PROMPT}] + history
        )

        for _ in range(12):
            completion = await asyncio.to_thread(
                aoai.chat.completions.create,
                model=AZURE_DEPLOYMENT,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                max_completion_tokens=16384,
            )
            choice = completion.choices[0]
            msg = choice.message

            # Reinsert the assistant message (including tool_calls if any) so
            # the next round has the full transcript.
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
                # Final assistant message — parse the dashboard JSON.
                raw = _strip_json_fence(msg.content or "")
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = {
                        "reply": msg.content or "(empty response)",
                        "components": [],
                        "chartType": None,
                        "chartData": None,
                    }
                parsed = _legacy_compat(parsed)

                # Persist trimmed history so follow-ups can build on it. We
                # store ONLY the user message and the final assistant
                # message — tool-call internals don't help future turns.
                history.append({"role": "assistant",
                                "content": parsed.get("reply", "")})
                SESSIONS[session_id] = history[-MAX_HISTORY * 2:]
                return parsed

            # Resolve every tool call before re-prompting.
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                print(f"--> tool {tc.function.name}({args})")
                tool_output = await _call_mcp_tool(
                    mcp_session, tc.function.name, args
                )
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_output,
                })

    return {
        "reply": "The model didn't converge within the tool-call budget.",
        "components": [],
        "chartType": None,
        "chartData": None,
    }


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "deployment": AZURE_DEPLOYMENT}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest) -> dict[str, Any]:
    session_id = request.session_id or uuid.uuid4().hex
    try:
        result = await _run_chat(request.message, session_id)
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e)) from e
    result["session_id"] = session_id
    return result


@app.post("/api/session/reset")
async def reset_session(session_id: str) -> dict[str, Any]:
    SESSIONS.pop(session_id, None)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
