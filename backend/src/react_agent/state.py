"""Agent state management."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from langchain_core.messages import AnyMessage
from langgraph.graph import add_messages
from langgraph.managed import IsLastStep
from typing_extensions import Annotated


@dataclass
class InputState:
    """Input state interface for external data.

    Defines initial state structure and incoming data format.
    """

    messages: Annotated[Sequence[AnyMessage], add_messages] = field(
        default_factory=list
    )
    """Message sequence tracking agent execution state.

    Accumulates conversation pattern:
    1. HumanMessage - user input
    2. AIMessage with tool_calls - agent tool selection
    3. ToolMessage(s) - tool execution responses
    4. AIMessage without tool_calls - agent response
    5. HumanMessage - next conversational turn

    Steps 2-5 repeat as needed. The add_messages annotation merges
    new messages with existing ones by ID for append-only state.
    """


@dataclass
class State(InputState):
    """Complete agent state extending InputState.

    Stores additional information throughout agent lifecycle.
    """

    is_last_step: IsLastStep = field(default=False)
    """Indicates current step is final before graph error.

    Managed variable controlled by state machine. Set to True
    when step count reaches recursion_limit - 1.
    """

    # Additional attributes can be added here as needed.
    # Common examples include:
    # retrieved_documents: List[Document] = field(default_factory=list)
    # extracted_entities: Dict[str, Any] = field(default_factory=dict)
    # api_connections: Dict[str, Any] = field(default_factory=dict)
