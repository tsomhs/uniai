"""
Central configuration — read once at import time.

All environment variables and filesystem paths live here so that
mcp_server.py, main.py, and any future modules share one source of truth.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Filesystem layout
# ---------------------------------------------------------------------------

BACKEND_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BACKEND_DIR / "data"

DB_PATH: Path = DATA_DIR / "conversations.duckdb"
METRICS_MD: Path = DATA_DIR / "metrics_dictionary.md"
SCHEMA_MD: Path = DATA_DIR / "schema.md"
JSONL_PATH: Path = DATA_DIR / "conversations.jsonl"

# ---------------------------------------------------------------------------
# Azure OpenAI
# ---------------------------------------------------------------------------

AZURE_OPENAI_KEY: str = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
# Smaller, cheaper deployment used for the self-critique pass and
# definitional-question routing. Falls back to the main deployment
# when not configured, so multi-tenancy/critique still work in dev.
AZURE_DEPLOYMENT_MINI: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_MINI", "") or AZURE_DEPLOYMENT
AZURE_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

# ---------------------------------------------------------------------------
# Runtime tuning
# ---------------------------------------------------------------------------

MAX_TOOL_ITERATIONS: int = int(os.getenv("MAX_TOOL_ITERATIONS", "12"))
MAX_SESSION_HISTORY: int = int(os.getenv("MAX_SESSION_HISTORY", "16"))
MAX_SQL_ROWS: int = int(os.getenv("MAX_SQL_ROWS", "500"))

# ---------------------------------------------------------------------------
# Startup validation
# ---------------------------------------------------------------------------

def validate() -> None:
    """Fail fast if the environment is not correctly set up."""
    errors: list[str] = []

    if not AZURE_OPENAI_KEY:
        errors.append("AZURE_OPENAI_KEY is not set (required for LLM calls).")
    if not AZURE_ENDPOINT:
        errors.append("AZURE_OPENAI_ENDPOINT is not set.")
    if not AZURE_DEPLOYMENT:
        errors.append("AZURE_OPENAI_DEPLOYMENT is not set.")

    if not DB_PATH.exists():
        errors.append(
            f"Database not found: {DB_PATH}\n"
            "  Copy conversations.duckdb into backend/data/ — do NOT regenerate."
        )

    if not METRICS_MD.exists():
        errors.append(f"Metrics dictionary not found: {METRICS_MD}")

    if not SCHEMA_MD.exists():
        errors.append(f"Schema dictionary not found: {SCHEMA_MD}")

    if errors:
        for e in errors:
            print(f"[CONFIG ERROR] {e}", file=sys.stderr)
        sys.exit(1)
