import asyncio
import sys
import os
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def test_connection():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    mcp_script_path = os.path.join(BASE_DIR, "mcp_server.py")
    
    print(f"1. Target MCP Script: {mcp_script_path}")
    print(f"2. Python Executable: {sys.executable}")
    
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[mcp_script_path],
        env=os.environ.copy()
    )
    
    try:
        print("3. Attempting to open stdio connection...")
        async with stdio_client(server_params) as (read, write):
            print("4. Stdio stream opened! Creating session...")
            async with ClientSession(read, write) as session:
                print("5. Initializing session...")
                await session.initialize()
                print("6. SUCCESS! Fetching tools...")
                tools = await session.list_tools()
                print(f"7. Found tools: {tools}")
                
    except Exception as e:
        print("\n❌ THE EXACT ERROR IS:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())