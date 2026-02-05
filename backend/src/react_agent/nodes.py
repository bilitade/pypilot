import os
from typing import Dict, List, cast
from datetime import UTC, datetime

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig

from react_agent.utils import load_chat_model
from react_agent.state import State
from react_agent.tools import TOOLS
from react_agent.prompts import SYSTEM_PROMPT

async def call_model(state: State, config: RunnableConfig) -> Dict[str, List[AIMessage]]:
    """Executes the core reasoning loop of the agent.
    
    Dynamically loads the requested model and binds available workspace tools.
    
    Args:
        state: Current agent state with message history.
        config: Configuration with model selection.

    Returns:
        Dictionary containing the AI response message.
    """
    # Resolve model from config or environment
    model_name = config["configurable"].get("model") or os.getenv("LLM_MODEL", "openai/gpt-5-mini")
    
    # Model-specific optimizations
    kwargs = {}
    if "openai" in model_name.lower():
        kwargs["parallel_tool_calls"] = True
        
    # Load and bind tools
    model = load_chat_model(model_name).bind_tools(
        TOOLS,
        **kwargs
    )
    
    # Inject system time into the prompt for temporal awareness
    prompt = SYSTEM_PROMPT.format(
        system_time=datetime.now(tz=UTC).isoformat()
    )

    # Invoke model with full history
    response = cast(
        AIMessage,
        await model.ainvoke(
            [
                {"role": "system", "content": prompt},
                *state.messages,
            ]
        ),
    )
    
    return {"messages": [response]}
