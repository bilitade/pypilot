"""API configuration settings."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    """Create and configure FastAPI application.
    
    Returns:
        Configured FastAPI application
    """
    app = FastAPI(title="PyPilot Agent API", version="1.0.0")
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    return app


def setup_routes(app: FastAPI) -> None:
    """Setup API routes.
    
    Args:
        app: FastAPI application instance
    """
    from app.routes import api_router
    app.include_router(api_router, tags=["chat", "health"])
