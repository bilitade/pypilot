
from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition


from react_agent.context import Context
from react_agent.state import InputState, State
from react_agent.tools import TOOLS
from react_agent.nodes import call_model





def build_agent_graph():
    graph = StateGraph(
        State,
        input_schema=InputState,
        context_schema=Context,
    )

    graph.add_node("call_model", call_model)
    graph.add_node("tools", ToolNode(TOOLS))

    graph.add_edge(START, "call_model")
    graph.add_conditional_edges("call_model", tools_condition)
    graph.add_edge("tools", "call_model")

    return graph.compile(name="ReAct Agent")


agentGraph = build_agent_graph()
