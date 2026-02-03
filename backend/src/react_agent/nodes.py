
from react_agent.utils import load_chat_model
from langchain_core.messages import AIMessage
from react_agent.state import State
from langgraph.runtime import Runtime
from react_agent.context import Context
from react_agent.tools import TOOLS
from datetime import UTC, datetime
from typing import Dict, List, cast

async def call_model(
    state: State,
    runtime: Runtime[Context],
) -> Dict[str, List[AIMessage]]:
    model = load_chat_model(runtime.context.model).bind_tools(TOOLS)

    system_message = runtime.context.system_prompt.format(
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

    if state.is_last_step and response.tool_calls:
        return {
            "messages": [
                AIMessage(
                    id=response.id,
                    content=(
                        "Sorry, I could not find an answer to your question "
                        "within the allowed number of steps."
                    ),
                )
            ]
        }

    return {"messages": [response]}
