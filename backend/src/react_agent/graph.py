
from langgraph.graph import START, END, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from react_agent.state import InputState, State
from react_agent.nodes import call_model


def build_agent_graph():
    """Build and configure agent execution graph.

    Returns:
        Compiled agent graph with memory checkpointer
    """
    
    graph = StateGraph(State, input_schema=InputState)
    graph.add_node("call_model", call_model)

    graph.add_edge(START, "call_model")
    graph.add_edge("call_model", END)  

   
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer, name="ReAct Agent")


agentGraph = build_agent_graph()
