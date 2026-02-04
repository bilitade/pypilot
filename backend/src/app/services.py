"""API business logic services."""

import asyncio
import json
import os
from typing import Dict, List, Any

from fastapi import HTTPException
from langchain_core.messages import ToolMessage

from react_agent.graph import agentGraph
from app.models import ChatRequest, ChatResponse, ToolCall


class ChatService:
    """Service for handling chat operations."""
    
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
            print(f"\n=== Chat Request ===")
            print(f"Thread ID: {request.thread_id}")
            print(f"Message: {request.message[:100]}...")
            print(f"Tool results: {len(request.tool_results) if request.tool_results else 0}")
            
            # Create thread config for LangGraph with checkpointer
            config = {
                "configurable": {
                    "thread_id": request.thread_id
                }
            }
            
            # Prepare input messages
            input_data = ChatService._prepare_input_data(request)
            
            # Invoke the agent
            print(f"Invoking agent with config: {config}")
            result = await agentGraph.ainvoke(input_data, config=config)
            
            # Extract response
            response_text, tool_calls = ChatService._extract_response(result)
            
            print(f"Response: {response_text[:100]}...")
            print(f"Tool calls: {len(tool_calls) if tool_calls else 0}")
            print("=== End Request ===\n")
            
            return ChatResponse(
                response=response_text,
                thread_id=request.thread_id,
                tool_calls=tool_calls,
                metadata={"status": "success"}
            )
            
        except Exception as e:
            print(f"Error processing chat request: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Error processing request: {str(e)}"
            )
    
    @staticmethod
    def _prepare_input_data(request: ChatRequest) -> Dict[str, Any]:
        """Prepare input data for agent invocation.
        
        Args:
            request: Chat request
            
        Returns:
            Input data dictionary
        """
        if not request.tool_results:
            # New message from user
            return {"messages": [{"role": "user", "content": request.message}]}
        else:
            # Tool results - need to add ToolMessages to the state
            tool_messages = []
            for result in request.tool_results:
                tool_messages.append(ToolMessage(
                    content=result.get("output", ""),
                    tool_call_id=result.get("tool_call_id", "")
                ))
            
            # Add tool messages to continue the conversation
            return {"messages": tool_messages}
    
    @staticmethod
    def _extract_response(result: Dict[str, Any]) -> tuple[str, List[ToolCall] | None]:
        """Extract response text and tool calls from agent result.
        
        Args:
            result: Agent invocation result
            
        Returns:
            Tuple of (response_text, tool_calls)
        """
        if not result or "messages" not in result or not result["messages"]:
            return "I'm sorry, I couldn't process your request.", None
        
        last_message = result["messages"][-1]
        print(f"Last message type: {type(last_message).__name__}")
        print(f"Last message dir: {[attr for attr in dir(last_message) if not attr.startswith('_')]}")
        
        # Extract text content
        response_text = ""
        if hasattr(last_message, 'content'):
            response_text = last_message.content
        else:
            response_text = str(last_message)
        
        # Debugging: Print full message attributes
        if hasattr(last_message, 'tool_calls'):
            print(f"Has tool_calls attribute: {last_message.tool_calls}")
        if hasattr(last_message, 'additional_kwargs'):
            print(f"Additional kwargs: {last_message.additional_kwargs}")
        
        # Extract tool calls if present
        tool_calls = None
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            tool_calls = []
            print(f"Found {len(last_message.tool_calls)} tool calls!")
            for tc in last_message.tool_calls:
                print(f"Tool call: {tc.get('name', '')} with args: {tc.get('args', {})}")
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
    """Service for health check operations."""
    
    @staticmethod
    def get_health_status() -> Dict[str, str]:
        """Get service health status.
        
        Returns:
            Health status dictionary
        """
        return {"status": "healthy", "service": "PyPilot Agent API"}


class RootService:
    """Service for root endpoint operations."""
    
    @staticmethod
    def get_api_info() -> Dict[str, Any]:
        """Get API information and endpoints.
        
        Returns:
            API information dictionary
        """
        return {
            "message": "PyPilot Agent API is running",
            "version": "1.0.0",
            "endpoints": {
                "chat": "/chat",
                "health": "/health"
            }
        }
