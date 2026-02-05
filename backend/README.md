# PyPilot Backend

FastAPI server with LangGraph agent that decides what tools to call.

## Structure

```
src/
├── app/
│   ├── main.py      # FastAPI app entry
│   ├── routes.py    # /chat, /health endpoints
│   └── services.py  # Business logic
└── react_agent/
    ├── graph.py     # LangGraph state machine
    ├── nodes.py     # Agent node (calls LLM)
    ├── tools.py     # Tool definitions
    ├── state.py     # State structure
    └── prompts.py   # System prompt
```

## How It Works

1. Extension POSTs to `/chat` with user message
2. LangGraph agent invokes LLM with tool definitions
3. LLM returns response + tool calls (if any)
4. Backend sends tool calls back to extension
5. Extension executes tools and POSTs results back
6. Agent processes results and continues

## Setup

```bash
# Install dependencies
uv sync

# Configure
cp .env.example .env
# Add OPENAI_API_KEY or GROQ_API_KEY

# Run
uv run python src/app/main.py
```

Runs on `http://localhost:8000`

## Environment Variables

```env
# Required (choose one or both)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Optional
LANGSMITH_API_KEY=ls__...     # For tracing
LANGSMITH_TRACING=true
TAVILY_API_KEY=tvly-...       # For web search
PORT=8000
LLM_MODEL=openai/gpt-4o-mini
```

## API

### POST `/chat`

**Request:**
```json
{
  "message": "Create hello.py",
  "thread_id": "thread_123",
  "model": "openai/gpt-4o-mini"
}
```

**Response:**
```json
{
  "response": "I'll create that file.",
  "thread_id": "thread_123",
  "tool_calls": [
    {
      "id": "call_xyz",
      "type": "function",
      "function": {
        "name": "write_file",
        "arguments": "{\"file_path\":\"hello.py\",\"content\":\"print('hello')\"}"
      }
    }
  ]
}
```

If `tool_calls` present, client executes them and POSTs back with `tool_results`.

### GET `/health`

```json
{"status": "healthy", "service": "PyPilot Agent API"}
```

## Tools

Defined in `tools.py`:
- `read_file(file_path)`
- `write_file(file_path, content)`
- `edit_file(file_path, old_text, new_text)`
- `delete_file(file_path)`
- `list_directory(directory_path)`
- `create_directory(directory_path)`
- `get_workspace_info()`
- `search_files(pattern)`
- `search(query)` - web search

These are schemas only. Execution happens client-side.

## Agent (ReAct Pattern)

Simple LangGraph:
- **Node**: `call_model` - loads LLM, binds tools, invokes
- **State**: message history (accumulated per thread_id)
- **Checkpointer**: `MemorySaver` (in-memory, lost on restart)

Flow:
```
START → call_model → END
```

Agent decides to call tools or respond based on conversation history.

## Models

Supported formats
- `openai/gpt-5-mini`:
- `openai/gpt-5`
- `openai/gpt-4o-mini`
- `openai/gpt-4`
- `groq/llama-3.3-70b-versatile`
- `groq/openai/gpt-oss-20b`

## State Management

Each `thread_id` maintains conversation history:
```python
messages = [
  HumanMessage("Create hello.py"),
  AIMessage(tool_calls=[...]),
  ToolMessage(result="Created"),
  AIMessage("Done!")
]
```

## Observability

Set `LANGSMITH_API_KEY` to trace agent runs at https://smith.langchain.com

See:
- Exact prompts
- LLM reasoning
- Tool calls
- Token usage

## Dependencies

- `langgraph` - Agent orchestration
- `langchain-openai` / `langchain-groq` - LLM providers
- `fastapi` + `uvicorn` - HTTP server
- `langchain-tavily` - Web search (optional)

See `pyproject.toml` for full list.
