import sys
import os
import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Google GenAI IMPORTS
from google import genai
from google.genai import types

# MCP Client Imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Initialize the Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 2. System Instruction
system_instruction = """
You are an expert Data Analyst AI for a banking voicebot. You are connected to a DuckDB database.
The database has flat views you should query: `v_conversations`, `v_turns`, `v_evaluations`.

IMPORTANT METRICS TO KNOW (Write SQL to calculate these):
- Containment Rate: Share of calls where `call_successful = 'success'` in v_conversations.
- Escalation Rate: Share of calls where `call_successful = 'unknown'` in v_conversations.
- Abandonment Rate: Share of calls where `termination_reason = 'caller_hung_up'` in v_conversations.

Step 1: Use `get_table_schema` to understand the columns of the view you need.
Step 2: Use `execute_sql` to write a DuckDB SQL query to get the exact answer. DO NOT GUESS.
Step 3: Analyze the SQL results and format your response.

CRITICAL INSTRUCTION:
Your final response MUST be a raw JSON object. Do not wrap it in markdown blockquotes (no ```json).
It must follow exactly this structure:
{
  "reply": "Your conversational text explaining the data here.",
  "chartType": "bar", // use "bar" or "line" if a chart is helpful, otherwise null
  "chartData": [{"name": "Category A", "value": 10}, {"name": "Category B", "value": 20}] // or null
}
"""

# 3. Define Tools
schema_tool = types.FunctionDeclaration(
    name="get_table_schema",
    description="Get the column names and data types of a specific table or view in the database.",
    parameters={
        "type": "OBJECT",
        "properties": {
            "table_name": {"type": "STRING", "description": "The name of the table or view"}
        },
        "required": ["table_name"]
    }
)

sql_tool = types.FunctionDeclaration(
    name="execute_sql",
    description="Execute a read-only SQL SELECT query against the database.",
    parameters={
        "type": "OBJECT",
        "properties": {
            "query": {"type": "STRING", "description": "The exact SQL SELECT query to execute."}
        },
        "required": ["query"]
    }
)

gemini_tools = [types.Tool(function_declarations=[schema_tool, sql_tool])]

chat_config = types.GenerateContentConfig(
    system_instruction=system_instruction,
    tools=gemini_tools,
    temperature=0.0 
)

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    user_message = request.message
    
    # 4. Use the exact absolute paths that worked in the test script!
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    mcp_script_path = os.path.join(BASE_DIR, "mcp_server.py")
    
    server_params = StdioServerParameters(
        command=sys.executable, 
        args=[mcp_script_path],
        env=os.environ.copy()
    )
    
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # USE ASYNC CLIENT: client.aio.chats
                chat = client.aio.chats.create(
                    model="gemini-2.5-pro",
                    config=chat_config
                )
                
                # AWAIT the async message
                response = await chat.send_message(user_message)

                # 5. THE EXECUTION LOOP
                while response.function_calls:
                    function_responses = []
                    
                    for fc in response.function_calls:
                        print(f"--> Gemini requested tool: {fc.name}")
                        
                        mcp_result = await session.call_tool(fc.name, arguments=dict(fc.args))
                        tool_output = mcp_result.content[0].text
                        print(f"--> MCP Server returned data")
                        
                        function_responses.append(
                            types.Part.from_function_response(
                                name=fc.name,
                                response={"result": tool_output}
                            )
                        )
                    
                    # AWAIT the async response
                    response = await chat.send_message(function_responses)

                # 6. Clean up Gemini's response
                raw_text = response.text.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()
                
                try:
                    return json.loads(raw_text)
                except json.JSONDecodeError as e:
                    print(f"JSON Parse Error: {e}")
                    return {"reply": raw_text, "chartType": None, "chartData": None}

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return {"reply": f"An internal error occurred: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)