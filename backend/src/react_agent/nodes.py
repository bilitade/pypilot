
import os
from react_agent.utils import load_chat_model
from langchain_core.messages import AIMessage
from react_agent.state import State
from react_agent.tools import TOOLS
from react_agent.prompts import SYSTEM_PROMPT
from datetime import UTC, datetime
from typing import Dict, List, cast


from langchain_core.runnables import RunnableConfig

async def call_model(state: State, config: RunnableConfig) -> Dict[str, List[AIMessage]]:
    """Process agent state and generate response.

    Args:
        state: Current agent state with message history
        config: Configuration with model selection

    Returns:
        Dictionary containing AI response message
    """
    model_name = config["configurable"].get("model") or os.getenv("LLM_MODEL", "openai/gpt-5-mini")
    
    kwargs = {}
    if model_name.startswith("openai/"):
        kwargs["parallel_tool_calls"] = True
        
    model = load_chat_model(model_name).bind_tools(
        TOOLS,
        **kwargs
    )
    system_message = SYSTEM_PROMPT.format(
        system_time=datetime.now(tz=UTC).isoformat()
    )

    response = cast(
        AIMessage,
        await model.ainvoke(
            [
                {"role": "system", "content": system_message},
                *state.messages,
            ]
        ),
    )
    return {"messages": [response]}

