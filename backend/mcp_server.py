from mcp.server.fastmcp import FastMCP
import duckdb
import os

# Initialize the MCP Server
mcp = FastMCP("Banking Voicebot Data Server")

# Get the absolute path to this folder to guarantee it finds the DB
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "conversations.duckdb")

con = duckdb.connect(db_path, read_only=True)

@mcp.tool()
def get_table_schema(table_name: str) -> str:
    """Get the column names and data types of a specific table or view in the database."""
    try:
        # DESCRIBE returns the schema in DuckDB
        df = con.execute(f"DESCRIBE {table_name}").df()
        return df.to_json(orient="records")
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def execute_sql(query: str) -> str:
    """
    Execute a read-only SQL SELECT query against the DuckDB database.
    Use this to calculate metrics, aggregate data, or fetch specific rows.
    """
    if not query.strip().upper().startswith("SELECT"):
        return "Error: Security block. Only SELECT queries are allowed."
    
    try:
        df = con.execute(query).df()
        # Limit to 100 rows so we don't crash Gemini's context window
        return df.head(100).to_json(orient="records")
    except Exception as e:
        return f"SQL Error: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport='stdio')