"""API route definitions."""

from fastapi import APIRouter

from app.models import ChatRequest, ChatResponse, HealthResponse, RootResponse
from app.services import ChatService, HealthService, RootService


# Create router
api_router = APIRouter(tags=["chat", "health"])


@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Process chat request with agent.
    
    Args:
        request: Chat request with message and thread ID
        
    Returns:
        Chat response with agent message and tool calls
        
    Raises:
        HTTPException: If request processing fails
    """
    return await ChatService.process_chat_request(request)


@api_router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint.
    
    Returns:
        Service health status
    """
    return HealthResponse(**HealthService.get_health_status())


@api_router.get("/", response_model=RootResponse)
async def root() -> RootResponse:
    """Root endpoint with API information.
    
    Returns:
        API metadata and available endpoints
    """
    return RootResponse(**RootService.get_api_info())
