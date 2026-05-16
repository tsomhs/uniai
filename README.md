# UniAI — Speak With Your Data

A natural-language analytics platform that converts plain questions into interactive dashboard components, backed by a DuckDB dataset of 10,000 synthetic banking voicebot calls.

Built at Makeathon by **Prompt Masters**.

---

## What It Does

You type a question in plain English (or Greek). The system:

1. Decides which data to fetch and generates SQL automatically
2. Executes the SQL read-only against DuckDB via an MCP server
3. Picks the right chart type and emits a validated JSON spec
4. Streams the result to the browser, which renders it with Recharts
5. Runs a second AI pass to review the answer for correctness

No code is generated. No React is emitted. The frontend has all chart types pre-built; the AI only decides which one to use and what data to feed it.

---

## Architecture

```
Browser (React + Recharts)
        │  SSE stream
        ▼
FastAPI  (main.py)
  ├─ Auth (session cookie, in-memory store)
  ├─ Session memory (conversation history per user)
  ├─ Model router (main GPT vs mini GPT)
  ├─ Dataset hints (ambiguous phrasing pre-processing)
  │
  ├─► Azure OpenAI  ←── tool-calling loop (up to 12 rounds)
  │        │
  │        │ MCP tool calls (stdio)
  │        ▼
  └─► MCP Server (mcp_server.py)
           │  read-only SELECT only (AST-validated by sqlglot)
           ▼
      DuckDB  (conversations.duckdb)
           │
      ┌────┴──────────────────────────┐
      │  v_conversations              │  one row per call
      │  v_turns                      │  one row per turn
      │  v_evaluations                │  one row per criterion
      │  v_data_collection            │  one row per collected field
      │  v_tool_calls                 │  one row per tool invocation
      └───────────────────────────────┘
```

### Key architectural decisions

| Decision | Choice | Why |
|---|---|---|
| LLM output format | JSON spec (not React code) | Frontend renders pre-built Recharts components; no eval, no code injection |
| Data access | MCP server over stdio per request | Clean boundary; SQL is AST-validated before reaching DuckDB |
| SQL authorship | LLM writes SQL, passed via tool call | All aggregation pushed into SQL; no post-processing in Python or JS |
| Streaming | Server-Sent Events | Progress messages appear while the tool-calling loop runs |
| Correctness check | Second LLM pass (mini model) | Independent review of SQL and data shape without blocking the response |
| Session memory | In-memory dict keyed by session_id | Follow-up questions have context; resets on server restart (hackathon scope) |

---

## Tech Stack

### Backend
| Package | Role |
|---|---|
| FastAPI + Uvicorn | HTTP server, SSE streaming |
| Azure OpenAI (`openai` SDK) | LLM inference (GPT-4o / mini) |
| MCP (`mcp[cli]`) | Tool-calling protocol between FastAPI and DuckDB |
| DuckDB | Embedded analytics database |
| sqlglot | SQL AST validation (read-only enforcement) |
| Pydantic v2 | Request validation + component shape validation |
| python-dotenv | Environment config |

### Frontend
| Package | Role |
|---|---|
| React 19 + Vite | UI framework and build tool |
| Recharts 3 | Bar, Line, Pie, Area, Scatter, Radar charts |
| Lucide React | Icons |
| react-markdown | Renders markdown in chat replies |

---

## Project Structure

```
uniai/
├── backend/
│   ├── main.py              # FastAPI app — auth, sessions, SSE, pipeline orchestration
│   ├── mcp_server.py        # MCP server — 6 read-only DuckDB tools
│   ├── datasource.py        # Datasource registry — uploads, Postgres, SQLite snapshots
│   ├── config.py            # All env vars and paths in one place
│   ├── requirements.txt
│   ├── .env.example
│   └── data/
│       ├── conversations.duckdb      # Pre-built dataset (do not regenerate)
│       ├── metrics_dictionary.md     # Canonical KPI formulas cited by the LLM
│       ├── schema.md                 # Column reference, intent catalog, view docs
│       ├── conversations.jsonl       # Source data (informational)
│       └── uploads/                  # Custom datasource DuckDB files (runtime)
└── frontend/
    ├── src/
    │   ├── App.jsx          # All UI: chat, charts, datasource modal, auth
    │   ├── AuthPage.jsx     # Login / register / guest entry screen
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- An Azure OpenAI resource with at least one GPT-4o deployment

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and fill in your Azure credentials:

```bash
cp .env.example .env
```

```env
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o          # main deployment (used for analytical queries)
AZURE_OPENAI_DEPLOYMENT_MINI=gpt-4o-mini  # mini deployment (critique + definitional Qs)
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Optional tuning (defaults shown)
# MAX_TOOL_ITERATIONS=12    # max tool-call rounds per request
# MAX_SESSION_HISTORY=16    # conversation turns kept per session
# MAX_SQL_ROWS=500          # max rows returned by execute_sql
```

Start the server:

```bash
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API Reference

All endpoints except `/api/auth/*` and `/api/health` require a valid session cookie obtained at login.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account `{name, email, password}` |
| `POST` | `/api/auth/login` | Login `{email, password}` → sets `session` cookie |
| `POST` | `/api/auth/guest` | Create a temporary guest session |
| `GET` | `/api/auth/me` | Return current user info |
| `POST` | `/api/auth/logout` | Clear session cookie |

### Chat

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | **Primary endpoint.** SSE stream of progress + result events |
| `POST` | `/api/chat` | Non-streaming JSON (backwards compatibility) |
| `POST` | `/api/session/reset` | Clear conversation history for a session |

#### SSE event types

```
{"type": "progress", "message": "Analysing your question…"}
{"type": "result",   "reply": "…", "components": […], "session_id": "…"}
{"type": "critique", "critique": {"verdict": "ok"|"minor"|"critical", "issues": […], "summary": "…"}}
{"type": "error",    "message": "…"}
data: [DONE]
```

#### Chat request body

```json
{
  "message":       "Give me the containment rate this week",
  "session_id":    "abc123",
  "datasource_id": "default",
  "user_level":    "simple" | "expert" | "auto" | null
}
```

### Datasources

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/datasource` | List available datasources for the current user |
| `POST` | `/api/datasource/upload` | Upload CSV / JSON / JSONL (multipart, max 100 MB) |
| `POST` | `/api/datasource/connect/postgres` | Snapshot PostgreSQL tables into DuckDB |
| `POST` | `/api/datasource/connect/sqlite` | Upload and snapshot a SQLite file |
| `DELETE` | `/api/datasource/{id}` | Delete a custom datasource |

### Source citations

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/source/section?file=metrics_dictionary.md&anchor=outcomes` | Fetch a markdown section by heading slug |

---

## Chart Types

The LLM chooses the chart type autonomously based on the data shape. All types are pre-built React components — no code is generated at runtime.

| Type | When it's chosen | Data shape |
|---|---|---|
| `kpi` | Single number with a target threshold | `[{name, value}]` |
| `bar` | Ranked categorical data | `[{name, value}, …]` sorted descending |
| `line` | Metric over a continuous time axis | `[{name: date, value}, …]` |
| `area` | Stacked or cumulative trend | same as line |
| `pie` | 2–6 mutually exclusive categories | `[{name, value}, …]` |
| `table` | >12 rows or many columns | `[{col: val, …}, …]` |
| `scatter` | Correlation between two numeric variables | `[{name, x, y}, …]` |
| `heatmap` | Intensity across two categorical dimensions | `[{x, y, value}, …]` |
| `radar` | Multi-metric comparison on a spider chart | `[{name, value}, …]` |
| `candlestick` | OHLC range data per time period | `[{name, open, high, low, close}, …]` |

Each component in the response also carries:
- `sql` — the exact query that produced the data (inspectable via the Data Inspector)
- `sources` — which sections of `metrics_dictionary.md` or `schema.md` were used
- `explanation` — why this chart type was chosen over alternatives
- `format` — unit, scale, decimal places, and threshold colouring rules

---

## Default Dataset

The pre-built `conversations.duckdb` contains 10,000 synthetic banking voicebot calls over a 90-day window. Key fields:

| View | Rows | Key columns |
|---|---|---|
| `v_conversations` | 10,000 | `start_date`, `segment`, `region`, `csat_score`, `outcome`, `call_successful`, `termination_reason`, `bot_version`, `main_language`, `cost_amount`, `call_duration_secs` |
| `v_turns` | ~80,000 | `conversation_id`, `role`, `detected_intent`, `sentiment`, `turn_number` |
| `v_evaluations` | ~50,000 | `conversation_id`, `criterion_id`, `result` (success/failure/unknown) |
| `v_data_collection` | ~30,000 | `conversation_id`, `field_id`, `value` |
| `v_tool_calls` | ~40,000 | `conversation_id`, `tool_name`, `success`, `latency_ms` |

Supported KPIs (see `data/metrics_dictionary.md` for canonical formulas):

- Containment / Resolution rate
- Escalation rate
- Abandonment rate
- CSAT (1–5 scale)
- Average Handle Time (AHT)
- First Call Resolution (FCR)
- Tool success rate
- Cost per call
- Repeat caller rate

---

## Custom Datasources

Beyond the default voicebot dataset, any authenticated user can bring their own data:

- **CSV / JSON / JSONL** — uploaded directly, ingested into an isolated DuckDB file
- **PostgreSQL** — selected tables are snapshotted into DuckDB at connect time (not a live connection)
- **SQLite** — uploaded `.db` / `.sqlite` files; all user tables are snapshotted

Custom datasources are scoped to their owner — other users cannot access them. They persist until the user deletes them or the server restarts.

---

## How the Pipeline Works (Short Version)

1. Request arrives at `POST /api/chat/stream`
2. Auth cookie → user email → session resolved
3. Model selected: mini for short definitional questions, main for everything else
4. MCP subprocess spawned; DuckDB opened read-only
5. GPT enters a tool-calling loop:
   - Reads `metrics_dictionary.md` (once per session)
   - Reads table schemas for any views it needs
   - Generates and executes SQL queries — one per chart
6. When GPT has enough data it emits a JSON spec (no more tool calls)
7. Each component is Pydantic-validated; malformed ones are dropped
8. Result SSE sent to browser → Recharts renders the charts immediately
9. A second GPT call (mini model) reviews the SQL and data for correctness
10. Critique result streamed as a final SSE event; session history saved

---

## Development Notes

- **Auth is in-memory** — all accounts and tokens reset on server restart. This is intentional for hackathon scope.
- **Do not regenerate `conversations.duckdb`** — it is a pre-built snapshot. The JSONL source is present for reference only.
- **MCP server is spawned per request** — there is no persistent MCP process. Each chat request starts and stops its own subprocess.
- **SQL safety** is enforced by AST parsing (`sqlglot`), not regex. INSERT/UPDATE/DELETE/DDL/ATTACH are all rejected before reaching DuckDB.
- **Session eviction** is FIFO at 500 sessions. No persistence across restarts.
- The frontend runs on port **5173** (Vite dev) or can be served as static files from `frontend/dist/`.
- The backend runs on port **8000**.
- CORS is configured for `localhost:5173` and `localhost:5174` only.
