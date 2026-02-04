"""API request/response models."""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class ToolCall(BaseModel):
    """Tool call model."""
    id: str
    type: str
    function: Dict[str, Any]


class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    thread_id: str = "default"
    tool_results: Optional[List[Dict[str, Any]]] = None


class ChatResponse(BaseModel):
    """Chat response model."""
    response: str
    thread_id: str
    tool_calls: Optional[List[ToolCall]] = None
    metadata: Dict[str, Any] = {}


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    service: str


class RootResponse(BaseModel):
    """Root endpoint response model."""
    message: str
    version: str
    endpoints: Dict[str, str]
