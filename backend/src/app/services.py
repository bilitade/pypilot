"""API business logic services."""

import json
from typing import Dict, List, Any

from fastapi import HTTPException
from langchain_core.messages import ToolMessage

from react_agent.graph import agentGraph
from app.models import ChatRequest, ChatResponse, ToolCall


class ChatService:
    """Service for handling chat operations through the LangGraph agent."""
    
    @staticmethod
    async def process_chat_request(request: ChatRequest) -> ChatResponse:
        """Process chat request with agent.
        
        Args:
            request: Chat request with message and thread ID
            
        Returns:
            Chat response with agent message and tool calls
            
        Raises:
            HTTPException: If request processing fails
        """
        try:
            # Create thread config for LangGraph with checkpointer support
            config = {
                "configurable": {
                    "thread_id": request.thread_id,
                    "model": request.model
                }
            }
            
            # Prepare state transition based on whether this is a new message or tool results
            input_data = ChatService._prepare_input_data(request)
            
            # Invoke the agent graph
            result = await agentGraph.ainvoke(input_data, config=config)
            
            # Extract response text and pending tool calls from the updated state
            response_text, tool_calls = ChatService._extract_response(result)
            
            return ChatResponse(
                response=response_text,
                thread_id=request.thread_id,
                tool_calls=tool_calls,
                metadata={"status": "success"}
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Internal agent error: {str(e)}"
            )
    
    @staticmethod
    def _prepare_input_data(request: ChatRequest) -> Dict[str, Any]:
        """Prepare input data for agent invocation.
        
        Args:
            request: Chat request
            
        Returns:
            Input data dictionary formatted for the graph
        """
        if not request.tool_results:
            # Initial user prompt
            return {"messages": [{"role": "user", "content": request.message}]}
        else:
            # Continuing a turn with execution results from the extension host
            tool_messages = []
            for result in request.tool_results:
                tool_messages.append(ToolMessage(
                    content=result.get("output", ""),
                    tool_call_id=result.get("tool_call_id", "")
                ))
            
            return {"messages": tool_messages}
    
    @staticmethod
    def _extract_response(result: Dict[str, Any]) -> tuple[str, List[ToolCall] | None]:
        """Extract readability content and tool metadata from high-level graph state.
        
        Args:
            result: Agent invocation output state
            
        Returns:
            Tuple of (response_text, list_of_tool_calls)
        """
        if not result or "messages" not in result or not result["messages"]:
            return "Assistant state is unclear.", None
        
        last_message = result["messages"][-1]
        
        # Extract text content if available
        response_text = ""
        if hasattr(last_message, 'content'):
            response_text = last_message.content
        else:
            response_text = str(last_message)
        
        # Extract structured tool calls
        tool_calls = None
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            tool_calls = []
            for tc in last_message.tool_calls:
                tool_calls.append(ToolCall(
                    id=tc.get("id", ""),
                    type="function",
                    function={
                        "name": tc.get("name", ""),
                        "arguments": json.dumps(tc.get("args", {}))
                    }
                ))
        
        return response_text, tool_calls


class HealthService:
    """Service for health check monitoring."""
    
    @staticmethod
    def get_health_status() -> Dict[str, str]:
        """Get service health status."""
        return {"status": "healthy", "service": "PyPilot Agent API"}


class RootService:
    """Service for discovery and root-level metadata."""
    
    @staticmethod
    def get_api_info() -> Dict[str, Any]:
        """Get API information and available endpoints."""
        return {
            "message": "PyPilot Agent API is running",
            "version": "1.0.0",
            "endpoints": {
                "chat": "/chat",
                "health": "/health"
            }
        }
